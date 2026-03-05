from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque

from .config import Settings
from .models import ExecutionResult, Side, TradeIntent


@dataclass(slots=True)
class TokenInventory:
    qty: float = 0.0
    avg_cost: float = 0.0


class RiskManager:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._last_order_ms: dict[str, int] = {}
        self._order_times_ms: Deque[int] = deque()
        self._inv: dict[str, TokenInventory] = defaultdict(TokenInventory)
        self._token_notional: dict[str, float] = defaultdict(float)

    def allow(self, intent: TradeIntent) -> tuple[bool, str]:
        now = int(time.time() * 1000)
        if self._token_cooldown(intent.token_id, now):
            return False, "token cooldown"
        if not self._rate_limit(now):
            return False, "global rate limit"

        token_notional = self._token_notional[intent.token_id]
        order_notional = intent.price * intent.size
        if intent.side == Side.BUY:
            if token_notional + order_notional > self.settings.max_position_usdc:
                return False, "max position reached"
        else:
            inv = self._inv[intent.token_id]
            if inv.qty < intent.size:
                return False, "insufficient inventory to sell"

        self._last_order_ms[intent.token_id] = now
        self._order_times_ms.append(now)
        return True, ""

    def on_execution(self, result: ExecutionResult) -> None:
        if not result.ok:
            return
        token = result.token_id
        inv = self._inv[token]
        notional = result.price * result.size

        if result.side == Side.BUY:
            new_qty = inv.qty + result.size
            if new_qty > 0:
                inv.avg_cost = ((inv.avg_cost * inv.qty) + notional) / new_qty
            inv.qty = new_qty
            self._token_notional[token] += notional
        else:
            inv.qty = max(0.0, inv.qty - result.size)
            if inv.qty == 0:
                inv.avg_cost = 0.0
                self._token_notional[token] = 0.0
            else:
                self._token_notional[token] = max(0.0, self._token_notional[token] - notional)

    def _token_cooldown(self, token_id: str, now_ms: int) -> bool:
        last = self._last_order_ms.get(token_id)
        if last is None:
            return False
        return (now_ms - last) < self.settings.per_token_cooldown_ms

    def _rate_limit(self, now_ms: int) -> bool:
        window_ms = 1000
        while self._order_times_ms and (now_ms - self._order_times_ms[0]) > window_ms:
            self._order_times_ms.popleft()
        return len(self._order_times_ms) < self.settings.max_orders_per_second

