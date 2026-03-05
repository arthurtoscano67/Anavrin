from __future__ import annotations

import asyncio
import logging
import signal
import ssl
import time
from collections import deque
from dataclasses import dataclass
from typing import Optional

import aiohttp
import certifi

from .config import Settings
from .execution import BaseExecutor, LivePolymarketExecutor, PaperExecutor
from .gamma import GammaMarketClient
from .market_ws import ClobMarketStream
from .models import BestBidAsk, BotStats, TradeIntent
from .prediction import BtcForecastService
from .risk import RiskManager
from .strategy import LatencyStrategy, TokenRef

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class RuntimeState:
    session: Optional[aiohttp.ClientSession] = None
    stream: Optional[ClobMarketStream] = None
    forecast: Optional[BtcForecastService] = None
    strategy: Optional[LatencyStrategy] = None
    risk: Optional[RiskManager] = None
    executor: Optional[BaseExecutor] = None


class LatencyHFTBot:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.stats = BotStats(current_min_edge=settings.min_edge)
        self.stop_event = asyncio.Event()
        self._state = RuntimeState()
        self._tasks: list[asyncio.Task] = []
        self._strategy_queue: asyncio.Queue = asyncio.Queue(maxsize=20_000)
        self._execution_queue: asyncio.Queue = asyncio.Queue(maxsize=8_000)
        self._adapt_window: deque[bool] = deque(maxlen=max(5, settings.adapt_every_trades))
        self._lat_window: deque[int] = deque(maxlen=200)

    async def run(self) -> None:
        self._install_signal_handlers()
        timeout = aiohttp.ClientTimeout(total=15)
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        connector = aiohttp.TCPConnector(limit=512, ttl_dns_cache=60, ssl=ssl_context)
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            self._state.session = session
            await self._bootstrap(session, ssl_context)
            await self._run_loop()

    async def _bootstrap(
        self, session: aiohttp.ClientSession, ssl_context: ssl.SSLContext
    ) -> None:
        gamma = GammaMarketClient(self.settings, session)
        markets = await gamma.fetch_btc_markets()
        if not markets:
            raise RuntimeError("No BTC Polymarket contracts discovered from Gamma API")
        logger.info("discovered %d BTC contracts", len(markets))

        token_map: dict[str, TokenRef] = {}
        for market in markets:
            token_map[market.yes_token_id] = TokenRef(market=market, is_yes=True)
            token_map[market.no_token_id] = TokenRef(market=market, is_yes=False)

        strategy = LatencyStrategy(self.settings, token_map)
        risk = RiskManager(self.settings)
        executor: BaseExecutor = (
            LivePolymarketExecutor(self.settings)
            if self.settings.is_live
            else PaperExecutor(self.settings)
        )
        forecast = BtcForecastService(self.settings, session)
        stream = ClobMarketStream(
            ws_url=self.settings.clob_ws_market_url,
            token_ids=list(token_map.keys()),
            on_quote=self._on_quote,
            ssl_context=ssl_context,
        )

        self._state.stream = stream
        self._state.forecast = forecast
        self._state.strategy = strategy
        self._state.risk = risk
        self._state.executor = executor

        self._tasks.append(asyncio.create_task(forecast.run(self.stop_event), name="forecast"))
        self._tasks.append(asyncio.create_task(stream.run(self.stop_event), name="market_ws"))
        if self.settings.rest_fallback_enabled:
            self._tasks.append(
                asyncio.create_task(
                    self._rest_quote_loop(list(token_map.keys())), name="rest_quotes"
                )
            )

        for i in range(self.settings.strategy_workers):
            self._tasks.append(
                asyncio.create_task(self._strategy_worker(i), name=f"strategy-{i}")
            )
        for i in range(self.settings.execution_workers):
            self._tasks.append(
                asyncio.create_task(self._execution_worker(i), name=f"execution-{i}")
            )
        self._tasks.append(asyncio.create_task(self._stats_loop(), name="stats"))

    async def _run_loop(self) -> None:
        await self.stop_event.wait()
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def _on_quote(self, quote) -> None:
        self.stats.ws_messages += 1
        executor = self._state.executor
        if executor:
            executor.on_quote(quote)
        try:
            self._strategy_queue.put_nowait(quote)
        except asyncio.QueueFull:
            # Drop oldest to keep hot data moving.
            try:
                _ = self._strategy_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            try:
                self._strategy_queue.put_nowait(quote)
            except asyncio.QueueFull:
                return

    async def _rest_quote_loop(self, token_ids: list[str]) -> None:
        if not token_ids or self._state.session is None:
            return

        poll_s = max(0.1, self.settings.rest_fallback_poll_ms / 1000.0)
        batch_size = max(1, self.settings.rest_fallback_batch_size)
        endpoint = f"{self.settings.clob_host}/books"
        session = self._state.session

        logger.info(
            "rest fallback enabled poll=%dms batch=%d tokens=%d",
            self.settings.rest_fallback_poll_ms,
            batch_size,
            len(token_ids),
        )

        while not self.stop_event.is_set():
            cycle_start = time.monotonic()
            for idx in range(0, len(token_ids), batch_size):
                batch = token_ids[idx : idx + batch_size]
                body = [{"token_id": token_id} for token_id in batch]
                try:
                    timeout = aiohttp.ClientTimeout(total=2.5)
                    async with session.post(endpoint, json=body, timeout=timeout) as resp:
                        if resp.status >= 400:
                            logger.warning("rest books status=%d", resp.status)
                            continue
                        payload = await resp.json()
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    logger.warning("rest books error: %s", exc)
                    continue

                if not isinstance(payload, list):
                    continue
                for item in payload:
                    quote = self._quote_from_book(item)
                    if quote is None:
                        continue
                    await self._on_quote(quote)

            remaining = poll_s - (time.monotonic() - cycle_start)
            await asyncio.sleep(max(0.0, remaining))

    @staticmethod
    def _quote_from_book(book: object) -> BestBidAsk | None:
        if not isinstance(book, dict):
            return None
        token_id = str(book.get("asset_id") or book.get("assetId") or "").strip()
        if not token_id:
            return None

        bids = book.get("bids") if isinstance(book.get("bids"), list) else []
        asks = book.get("asks") if isinstance(book.get("asks"), list) else []

        best_bid = 0.0
        best_ask = 0.0
        for level in bids:
            if not isinstance(level, dict):
                continue
            try:
                px = float(level.get("price", 0))
            except (TypeError, ValueError):
                continue
            if px > best_bid:
                best_bid = px

        for level in asks:
            if not isinstance(level, dict):
                continue
            try:
                px = float(level.get("price", 0))
            except (TypeError, ValueError):
                continue
            if px <= 0:
                continue
            if best_ask <= 0 or px < best_ask:
                best_ask = px

        if best_bid <= 0 and best_ask <= 0:
            return None

        ts_exchange_ms = None
        try:
            ts_exchange_ms = int(book.get("timestamp")) if book.get("timestamp") else None
        except (TypeError, ValueError):
            ts_exchange_ms = None

        return BestBidAsk(
            token_id=token_id,
            bid=max(0.0, min(1.0, best_bid)),
            ask=max(0.0, min(1.0, best_ask)),
            ts_exchange_ms=ts_exchange_ms,
            ts_local_ms=int(time.time() * 1000),
        )

    async def _strategy_worker(self, worker_id: int) -> None:
        del worker_id
        strategy = self._state.strategy
        forecast_service = self._state.forecast
        if strategy is None or forecast_service is None:
            return

        while not self.stop_event.is_set():
            quote = await self._strategy_queue.get()
            self.stats.scans += 1
            forecast = forecast_service.latest
            if forecast is None:
                continue
            now_ms = int(time.time() * 1000)
            if (now_ms - forecast.ts_ms) > self.settings.stale_forecast_ms:
                continue
            if (now_ms - quote.ts_local_ms) > self.settings.stale_quote_ms:
                continue
            intent = strategy.evaluate(quote=quote, forecast=forecast)
            if intent is None:
                continue
            self.stats.intents += 1
            try:
                self._execution_queue.put_nowait(intent)
            except asyncio.QueueFull:
                continue

    async def _execution_worker(self, worker_id: int) -> None:
        del worker_id
        risk = self._state.risk
        executor = self._state.executor
        strategy = self._state.strategy
        if risk is None or executor is None or strategy is None:
            return

        while not self.stop_event.is_set():
            intent: TradeIntent = await self._execution_queue.get()
            allowed, reason = risk.allow(intent)
            if not allowed:
                self.stats.risk_rejected += 1
                if self.settings.verbose:
                    logger.debug("risk reject token=%s reason=%s", intent.token_id, reason)
                continue

            self.stats.submitted += 1
            result = await executor.execute(intent)
            risk.on_execution(result)
            self._lat_window.append(result.latency_ms)

            if result.ok:
                self.stats.filled += 1
                self._adapt_window.append(True)
            else:
                self.stats.failed += 1
                self._adapt_window.append(False)
                if self.settings.verbose:
                    logger.warning(
                        "execution failed token=%s side=%s err=%s",
                        intent.token_id,
                        intent.side.value,
                        result.error,
                    )
            if self.settings.auto_adapt:
                self._maybe_adapt(strategy)

    def _maybe_adapt(self, strategy: LatencyStrategy) -> None:
        if len(self._adapt_window) < self.settings.adapt_every_trades:
            return
        fill_ratio = sum(1 for x in self._adapt_window if x) / len(self._adapt_window)
        min_edge = strategy.dynamic_min_edge
        if fill_ratio < 0.35:
            min_edge += 0.0005
        elif fill_ratio > 0.8:
            min_edge -= 0.0002
        min_edge = max(self.settings.min_edge_floor, min(self.settings.min_edge_cap, min_edge))
        strategy.update_min_edge(min_edge)
        self.stats.current_min_edge = min_edge
        self._adapt_window.clear()

    async def _stats_loop(self) -> None:
        while not self.stop_event.is_set():
            await asyncio.sleep(1.0)
            if self._lat_window:
                self.stats.avg_exec_latency_ms = sum(self._lat_window) / len(self._lat_window)
            if self._state.executor:
                self.stats.est_pnl_usdc = self._state.executor.equity()

            logger.info(
                "scans=%d ws=%d intents=%d submitted=%d filled=%d failed=%d rej=%d edge=%.4f eq=%.2f lat=%.1fms q=%d/%d",
                self.stats.scans,
                self.stats.ws_messages,
                self.stats.intents,
                self.stats.submitted,
                self.stats.filled,
                self.stats.failed,
                self.stats.risk_rejected,
                self.stats.current_min_edge,
                self.stats.est_pnl_usdc,
                self.stats.avg_exec_latency_ms,
                self._strategy_queue.qsize(),
                self._execution_queue.qsize(),
            )

    def _install_signal_handlers(self) -> None:
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, self.stop_event.set)
            except NotImplementedError:
                pass
