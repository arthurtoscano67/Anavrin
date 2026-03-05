from __future__ import annotations

import asyncio
import logging
import math
import time
from typing import Any, Optional

import aiohttp

from .config import Settings
from .models import BtcForecast

logger = logging.getLogger(__name__)


class BtcForecastService:
    def __init__(self, settings: Settings, session: aiohttp.ClientSession) -> None:
        self.settings = settings
        self.session = session
        self._latest: Optional[BtcForecast] = None

    @property
    def latest(self) -> Optional[BtcForecast]:
        return self._latest

    async def run(self, stop_event: asyncio.Event) -> None:
        poll_s = max(0.05, self.settings.forecast_poll_ms / 1000.0)
        while not stop_event.is_set():
            try:
                fc = await self.fetch_forecast()
                if fc:
                    self._latest = fc
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("forecast fetch failed: %s", exc)
            await asyncio.sleep(poll_s)

    async def fetch_forecast(self) -> Optional[BtcForecast]:
        if self.settings.forecast_endpoint:
            external = await self._fetch_external_prediction()
            if external:
                return external
        return await self._build_model_forecast()

    async def _fetch_external_prediction(self) -> Optional[BtcForecast]:
        timeout = aiohttp.ClientTimeout(total=self.settings.forecast_timeout_ms / 1000.0)
        async with self.session.get(
            self.settings.forecast_endpoint, timeout=timeout
        ) as resp:
            if resp.status >= 400:
                raise RuntimeError(
                    f"forecast endpoint status={resp.status} url={self.settings.forecast_endpoint}"
                )
            data = await resp.json()
        return await self._parse_external_payload(data)

    async def _parse_external_payload(self, data: Any) -> Optional[BtcForecast]:
        if not isinstance(data, dict):
            return None

        payload = data
        if isinstance(data.get("prediction"), dict):
            payload = data["prediction"]

        pred_price = self._first_float(
            payload,
            (
                "predicted_price_15m",
                "predicted_price",
                "price_15m",
                "price",
                "forecast_price",
            ),
        )
        if pred_price is None:
            return None

        spot = self._first_float(payload, ("spot_price", "spot", "current_price"))
        if spot is None:
            spot = await self._fetch_spot_price_binance()
            if spot is None:
                return None

        confidence = self._first_float(payload, ("confidence", "probability", "score"))
        if confidence is None:
            confidence = 0.62

        return BtcForecast(
            predicted_price_15m=pred_price,
            spot_price=spot,
            confidence=max(0.01, min(0.99, float(confidence))),
            source="external",
            ts_ms=int(time.time() * 1000),
        )

    async def _build_model_forecast(self) -> Optional[BtcForecast]:
        spot = await self._fetch_spot_price_binance()
        if spot is None:
            return None

        candles = await self._fetch_1m_klines_binance(limit=90)
        if len(candles) < 20:
            return None

        closes = [float(c[4]) for c in candles]
        ret_15 = closes[-1] / closes[-16] - 1.0 if closes[-16] > 0 else 0.0
        ret_5 = closes[-1] / closes[-6] - 1.0 if closes[-6] > 0 else 0.0
        log_rets = []
        for i in range(1, len(closes)):
            if closes[i - 1] <= 0:
                continue
            log_rets.append(math.log(closes[i] / closes[i - 1]))
        sigma_1m = (
            (sum((x - (sum(log_rets) / len(log_rets))) ** 2 for x in log_rets) / len(log_rets))
            ** 0.5
            if log_rets
            else 0.0
        )

        # Lightweight momentum + mean-reversion blend for a 15m directional estimate.
        pred_ret = (0.75 * ret_15) + (0.35 * ret_5) - (0.2 * ret_5 * abs(ret_15))
        pred_ret = max(-0.03, min(0.03, pred_ret))
        predicted = spot * (1.0 + pred_ret)
        expected_noise = max(1e-6, sigma_1m * (15.0**0.5))
        confidence = min(0.98, max(0.51, abs(pred_ret) / (2.5 * expected_noise)))

        return BtcForecast(
            predicted_price_15m=predicted,
            spot_price=spot,
            confidence=confidence,
            source="model",
            ts_ms=int(time.time() * 1000),
        )

    async def _fetch_spot_price_binance(self) -> Optional[float]:
        url = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
        timeout = aiohttp.ClientTimeout(total=self.settings.forecast_timeout_ms / 1000.0)
        async with self.session.get(url, timeout=timeout) as resp:
            if resp.status >= 400:
                return None
            payload = await resp.json()
        try:
            return float(payload["price"])
        except (KeyError, TypeError, ValueError):
            return None

    async def _fetch_1m_klines_binance(self, limit: int) -> list[list[Any]]:
        url = f"https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit={limit}"
        timeout = aiohttp.ClientTimeout(total=self.settings.forecast_timeout_ms / 1000.0)
        async with self.session.get(url, timeout=timeout) as resp:
            if resp.status >= 400:
                return []
            payload = await resp.json()
        return payload if isinstance(payload, list) else []

    @staticmethod
    def _first_float(payload: dict[str, Any], keys: tuple[str, ...]) -> Optional[float]:
        for key in keys:
            value = payload.get(key)
            try:
                if value is None:
                    continue
                return float(value)
            except (TypeError, ValueError):
                continue
        return None

