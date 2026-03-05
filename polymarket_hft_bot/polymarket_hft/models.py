from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


@dataclass(slots=True)
class MarketDefinition:
    market_id: str
    condition_id: str
    slug: str
    question: str
    end_date_iso: str
    yes_token_id: str
    no_token_id: str
    strike_price: Optional[float] = None
    tags: tuple[str, ...] = ()


@dataclass(slots=True)
class BestBidAsk:
    token_id: str
    bid: float
    ask: float
    ts_exchange_ms: Optional[int] = None
    ts_local_ms: int = 0

    @property
    def mid(self) -> float:
        if self.bid <= 0 and self.ask > 0:
            return self.ask
        if self.ask <= 0 and self.bid > 0:
            return self.bid
        return (self.bid + self.ask) / 2.0


@dataclass(slots=True)
class BtcForecast:
    predicted_price_15m: float
    spot_price: float
    confidence: float
    source: str
    ts_ms: int

    @property
    def predicted_return(self) -> float:
        if self.spot_price <= 0:
            return 0.0
        return (self.predicted_price_15m - self.spot_price) / self.spot_price


@dataclass(slots=True)
class TradeIntent:
    token_id: str
    side: Side
    price: float
    size: float
    edge: float
    fair_price: float
    market_id: str
    condition_id: str
    reason: str
    created_ms: int
    strategy_meta: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ExecutionResult:
    ok: bool
    token_id: str
    side: Side
    size: float
    price: float
    submitted_ms: int
    completed_ms: int
    order_id: str = ""
    error: str = ""
    response: Dict[str, Any] = field(default_factory=dict)

    @property
    def latency_ms(self) -> int:
        return max(0, self.completed_ms - self.submitted_ms)


@dataclass(slots=True)
class PositionLot:
    token_id: str
    qty: float
    avg_price: float
    side: Side
    opened_ms: int
    market_id: str
    condition_id: str


@dataclass(slots=True)
class BotStats:
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    scans: int = 0
    ws_messages: int = 0
    intents: int = 0
    risk_rejected: int = 0
    submitted: int = 0
    filled: int = 0
    failed: int = 0
    est_pnl_usdc: float = 0.0
    current_min_edge: float = 0.003
    avg_exec_latency_ms: float = 0.0

