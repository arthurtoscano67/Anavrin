from __future__ import annotations

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict

from .config import Settings
from .models import BestBidAsk, ExecutionResult, Side, TradeIntent

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class Holding:
    qty: float = 0.0
    avg_cost: float = 0.0


class BaseExecutor(ABC):
    @abstractmethod
    async def execute(self, intent: TradeIntent) -> ExecutionResult:
        raise NotImplementedError

    @abstractmethod
    def on_quote(self, quote: BestBidAsk) -> None:
        raise NotImplementedError

    @abstractmethod
    def equity(self) -> float:
        raise NotImplementedError


class PaperExecutor(BaseExecutor):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.cash = settings.paper_starting_cash
        self.realized_pnl = 0.0
        self.holdings: Dict[str, Holding] = {}
        self.last_mid: Dict[str, float] = {}

    async def execute(self, intent: TradeIntent) -> ExecutionResult:
        submitted_ms = int(time.time() * 1000)
        await asyncio.sleep(0)
        slip = self.settings.paper_fill_bps / 10000.0
        fill_px = intent.price * (1.0 + slip if intent.side == Side.BUY else 1.0 - slip)
        fill_px = max(0.001, min(0.999, fill_px))

        notional = fill_px * intent.size
        if intent.side == Side.BUY and self.cash < notional:
            return ExecutionResult(
                ok=False,
                token_id=intent.token_id,
                side=intent.side,
                size=intent.size,
                price=fill_px,
                submitted_ms=submitted_ms,
                completed_ms=int(time.time() * 1000),
                error="paper: insufficient cash",
            )

        hold = self.holdings.setdefault(intent.token_id, Holding())
        if intent.side == Side.SELL and hold.qty < intent.size:
            return ExecutionResult(
                ok=False,
                token_id=intent.token_id,
                side=intent.side,
                size=intent.size,
                price=fill_px,
                submitted_ms=submitted_ms,
                completed_ms=int(time.time() * 1000),
                error="paper: insufficient qty",
            )

        if intent.side == Side.BUY:
            new_qty = hold.qty + intent.size
            hold.avg_cost = ((hold.avg_cost * hold.qty) + (intent.size * fill_px)) / new_qty
            hold.qty = new_qty
            self.cash -= notional
        else:
            pnl = (fill_px - hold.avg_cost) * intent.size
            self.realized_pnl += pnl
            hold.qty -= intent.size
            if hold.qty <= 0:
                hold.qty = 0
                hold.avg_cost = 0.0
            self.cash += notional

        return ExecutionResult(
            ok=True,
            token_id=intent.token_id,
            side=intent.side,
            size=intent.size,
            price=fill_px,
            submitted_ms=submitted_ms,
            completed_ms=int(time.time() * 1000),
            order_id=f"paper-{submitted_ms}",
            response={"paper": True, "cash": self.cash},
        )

    def on_quote(self, quote: BestBidAsk) -> None:
        self.last_mid[quote.token_id] = quote.mid

    def equity(self) -> float:
        inv_value = 0.0
        for token_id, hold in self.holdings.items():
            if hold.qty <= 0:
                continue
            inv_value += hold.qty * self.last_mid.get(token_id, hold.avg_cost)
        return self.cash + inv_value


class LivePolymarketExecutor(BaseExecutor):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = None
        self._lock = asyncio.Lock()

    def on_quote(self, quote: BestBidAsk) -> None:
        del quote

    def equity(self) -> float:
        # Wallet balance fetches are intentionally not on the hot path.
        return 0.0

    async def execute(self, intent: TradeIntent) -> ExecutionResult:
        submitted_ms = int(time.time() * 1000)
        async with self._lock:
            try:
                result = await asyncio.to_thread(self._execute_blocking, intent, submitted_ms)
                return result
            except Exception as exc:
                return ExecutionResult(
                    ok=False,
                    token_id=intent.token_id,
                    side=intent.side,
                    size=intent.size,
                    price=intent.price,
                    submitted_ms=submitted_ms,
                    completed_ms=int(time.time() * 1000),
                    error=str(exc),
                )

    def _execute_blocking(self, intent: TradeIntent, submitted_ms: int) -> ExecutionResult:
        client = self._ensure_client()
        buy_side, sell_side, order_args_cls, order_type = self._import_types()
        side = buy_side if intent.side == Side.BUY else sell_side
        order = order_args_cls(
            token_id=intent.token_id,
            price=round(intent.price, 4),
            size=round(intent.size, 4),
            side=side,
        )
        signed = client.create_order(order)
        response = client.post_order(signed, order_type.FOK)
        order_id = ""
        if isinstance(response, dict):
            order_id = str(response.get("orderID") or response.get("orderId") or "")
        return ExecutionResult(
            ok=True,
            token_id=intent.token_id,
            side=intent.side,
            size=intent.size,
            price=intent.price,
            submitted_ms=submitted_ms,
            completed_ms=int(time.time() * 1000),
            order_id=order_id,
            response=response if isinstance(response, dict) else {"raw": str(response)},
        )

    def _ensure_client(self):
        if self._client is not None:
            return self._client
        if not self.settings.private_key:
            raise RuntimeError("POLYMARKET_PRIVATE_KEY is required in live mode")
        clob_client_cls, api_creds_cls = self._import_client_types()
        client = clob_client_cls(
            self.settings.clob_host,
            key=self.settings.private_key,
            chain_id=self.settings.chain_id,
            signature_type=self.settings.signature_type,
            funder=self.settings.funder_address or None,
        )
        if self.settings.api_key and self.settings.api_secret and self.settings.api_passphrase:
            api_creds = api_creds_cls(
                api_key=self.settings.api_key,
                api_secret=self.settings.api_secret,
                api_passphrase=self.settings.api_passphrase,
            )
        else:
            api_creds = client.create_or_derive_api_creds()
        client.set_api_creds(api_creds)
        self._client = client
        return client

    @staticmethod
    def _import_client_types():
        try:
            from py_clob_client.client import ClobClient
            from py_clob_client.clob_types import ApiCreds
        except ImportError as exc:
            raise RuntimeError(
                "py-clob-client missing. Install dependencies from requirements.txt"
            ) from exc
        return ClobClient, ApiCreds

    @staticmethod
    def _import_types():
        try:
            from py_clob_client.clob_types import OrderArgs, OrderType
            from py_clob_client.order_builder.constants import BUY, SELL
        except ImportError as exc:
            raise RuntimeError(
                "py-clob-client missing. Install dependencies from requirements.txt"
            ) from exc
        return BUY, SELL, OrderArgs, OrderType

