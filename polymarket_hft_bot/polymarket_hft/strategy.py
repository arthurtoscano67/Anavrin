from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import Optional

from .config import Settings
from .models import BtcForecast, BestBidAsk, MarketDefinition, Side, TradeIntent


@dataclass(slots=True)
class TokenRef:
    market: MarketDefinition
    is_yes: bool


def _normal_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


class LatencyStrategy:
    def __init__(self, settings: Settings, token_map: dict[str, TokenRef]) -> None:
        self.settings = settings
        self.token_map = token_map
        self.dynamic_min_edge = settings.min_edge

    def update_min_edge(self, value: float) -> None:
        self.dynamic_min_edge = max(self.settings.min_edge_floor, min(self.settings.min_edge_cap, value))

    def evaluate(
        self,
        quote: BestBidAsk,
        forecast: Optional[BtcForecast],
    ) -> Optional[TradeIntent]:
        if forecast is None:
            return None
        token_ref = self.token_map.get(quote.token_id)
        if token_ref is None:
            return None
        if quote.ask <= 0 and quote.bid <= 0:
            return None

        fair_yes = self._fair_yes_probability(token_ref.market, forecast)
        fair = fair_yes if token_ref.is_yes else (1.0 - fair_yes)
        fair = max(0.01, min(0.99, fair))

        total_cost_buffer = self.dynamic_min_edge + self.settings.fee_buffer + self.settings.slippage_buffer

        buy_edge = fair - quote.ask
        sell_edge = quote.bid - fair

        side: Side | None = None
        price = 0.0
        edge = 0.0
        if quote.ask > 0 and buy_edge > total_cost_buffer:
            side = Side.BUY
            price = quote.ask
            edge = buy_edge
        elif quote.bid > 0 and sell_edge > total_cost_buffer:
            side = Side.SELL
            price = quote.bid
            edge = sell_edge
        else:
            return None

        if price < self.settings.price_floor or price > self.settings.price_ceiling:
            return None

        size = self._size_for_edge(edge=edge, confidence=forecast.confidence, price=price)
        if size <= 0:
            return None

        return TradeIntent(
            token_id=quote.token_id,
            side=side,
            price=round(price, 4),
            size=round(size, 4),
            edge=edge,
            fair_price=fair,
            market_id=token_ref.market.market_id,
            condition_id=token_ref.market.condition_id,
            reason=f"edge={edge:.4f} fair={fair:.4f} src={forecast.source}",
            created_ms=int(time.time() * 1000),
            strategy_meta={
                "predicted_return": forecast.predicted_return,
                "forecast_conf": forecast.confidence,
                "market_slug": token_ref.market.slug,
                "is_yes": token_ref.is_yes,
            },
        )

    def _fair_yes_probability(self, market: MarketDefinition, forecast: BtcForecast) -> float:
        if market.strike_price and market.strike_price > 0:
            sigma = max(
                0.0008,
                abs(forecast.predicted_return) * 0.7 + self.settings.expected_15m_volatility,
            )
            std = forecast.spot_price * sigma
            if std <= 0:
                return 0.5
            z = (forecast.predicted_price_15m - market.strike_price) / std
            base = _normal_cdf(z)
        else:
            scale = max(0.0008, self.settings.expected_15m_volatility)
            z = forecast.predicted_return / scale
            base = 1.0 / (1.0 + math.exp(-z))

        # Confidence shrinks signal toward 50/50 when external model quality is low.
        conf = max(0.01, min(0.99, forecast.confidence))
        centered = (base - 0.5) * (0.6 + 0.8 * conf)
        return max(0.01, min(0.99, 0.5 + centered))

    def _size_for_edge(self, edge: float, confidence: float, price: float) -> float:
        notional = min(
            self.settings.max_order_usdc,
            1.0 + (edge * 1800.0) * (0.5 + confidence),
        )
        notional = max(1.0, notional)
        if price <= 0:
            return 0.0
        return notional / price

