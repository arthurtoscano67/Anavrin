from __future__ import annotations

import asyncio
import json
import logging
import ssl
import time
from typing import Any, Awaitable, Callable, Iterable

import websockets
from websockets.client import WebSocketClientProtocol

from .models import BestBidAsk

logger = logging.getLogger(__name__)

QuoteCallback = Callable[[BestBidAsk], Awaitable[None]]


def _as_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _events(payload: Any) -> Iterable[dict[str, Any]]:
    if isinstance(payload, dict):
        if isinstance(payload.get("events"), list):
            for evt in payload["events"]:
                if isinstance(evt, dict):
                    yield evt
            return
        yield payload
        return
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                yield item


def _extract_quote(event: dict[str, Any]) -> BestBidAsk | None:
    token_id = (
        event.get("asset_id")
        or event.get("assetId")
        or event.get("token_id")
        or event.get("tokenId")
    )
    if token_id is None:
        return None
    token_id = str(token_id)

    book = event.get("book")
    source = event if not isinstance(book, dict) else {**event, **book}
    bid = _as_float(
        source.get("best_bid")
        or source.get("bestBid")
        or source.get("bid")
        or source.get("b")
    )
    ask = _as_float(
        source.get("best_ask")
        or source.get("bestAsk")
        or source.get("ask")
        or source.get("a")
    )
    if bid <= 0 and ask <= 0:
        return None

    ts_exchange_ms = source.get("timestamp_ms") or source.get("timestamp")
    try:
        ts_exchange_ms = int(ts_exchange_ms) if ts_exchange_ms is not None else None
    except (TypeError, ValueError):
        ts_exchange_ms = None

    return BestBidAsk(
        token_id=token_id,
        bid=max(0.0, min(1.0, bid)),
        ask=max(0.0, min(1.0, ask)),
        ts_exchange_ms=ts_exchange_ms,
        ts_local_ms=int(time.time() * 1000),
    )


class ClobMarketStream:
    def __init__(
        self,
        ws_url: str,
        token_ids: list[str],
        on_quote: QuoteCallback,
        ssl_context: ssl.SSLContext | None = None,
        reconnect_delay_s: float = 0.25,
    ) -> None:
        self.ws_url = ws_url
        self.token_ids = token_ids
        self.on_quote = on_quote
        self.ssl_context = ssl_context
        self.reconnect_delay_s = reconnect_delay_s

    async def _subscribe(self, ws: WebSocketClientProtocol) -> None:
        # Docs currently show lowercase `market` and `asset_ids`.
        payload = {"type": "market", "asset_ids": self.token_ids}
        await ws.send(json.dumps(payload))

    async def run(self, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            try:
                async with websockets.connect(
                    self.ws_url,
                    ssl=self.ssl_context,
                    ping_interval=10,
                    ping_timeout=10,
                    max_queue=10_000,
                    close_timeout=2,
                ) as ws:
                    logger.info("connected market ws: %s", self.ws_url)
                    await self._subscribe(ws)
                    await self._reader_loop(ws, stop_event)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("market ws disconnected: %s", exc)
                await asyncio.sleep(self.reconnect_delay_s)

    async def _reader_loop(
        self, ws: WebSocketClientProtocol, stop_event: asyncio.Event
    ) -> None:
        while not stop_event.is_set():
            raw = await ws.recv()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue

            for event in _events(payload):
                quote = _extract_quote(event)
                if quote is None:
                    continue
                await self.on_quote(quote)
