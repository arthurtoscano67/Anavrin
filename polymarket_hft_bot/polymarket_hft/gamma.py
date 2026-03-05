from __future__ import annotations

import json
import re
from typing import Any, Iterable, List

import aiohttp

from .config import Settings
from .models import MarketDefinition

_STRIKE_RE = re.compile(r"\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)")


def _to_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []
        try:
            parsed = json.loads(stripped)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            return []
    return []


def _lower_join(parts: Iterable[str]) -> str:
    return " ".join(p.lower() for p in parts if p)


def _extract_strike(question: str) -> float | None:
    best = None
    for match in _STRIKE_RE.finditer(question):
        candidate = match.group(1).replace(",", "")
        try:
            price = float(candidate)
        except ValueError:
            continue
        if price > 1_000:
            best = price
    return best


def _is_btc_market(market: dict[str, Any], only_15m: bool) -> bool:
    text = _lower_join(
        [
            str(market.get("question", "")),
            str(market.get("slug", "")),
            str(market.get("description", "")),
        ]
    )
    if "bitcoin" not in text and "btc" not in text:
        return False
    if not only_15m:
        return True
    return any(
        key in text
        for key in (
            "15 min",
            "15-minute",
            "15m",
            "fifteen minute",
            "in 15 minutes",
        )
    )


def _parse_market(raw: dict[str, Any]) -> MarketDefinition | None:
    outcomes = [str(x) for x in _to_list(raw.get("outcomes"))]
    token_ids = [str(x) for x in _to_list(raw.get("clobTokenIds"))]
    if len(token_ids) < 2:
        return None

    yes_idx = 0
    no_idx = 1
    if outcomes:
        lowered = [x.lower() for x in outcomes]
        if "yes" in lowered:
            yes_idx = lowered.index("yes")
        if "no" in lowered:
            no_idx = lowered.index("no")
    if yes_idx >= len(token_ids) or no_idx >= len(token_ids):
        return None

    market_id = str(raw.get("id", "")).strip()
    condition_id = str(raw.get("conditionId", "")).strip()
    question = str(raw.get("question", "")).strip()
    if not market_id or not condition_id or not question:
        return None

    tags = tuple(str(x) for x in _to_list(raw.get("tags")) if x)
    return MarketDefinition(
        market_id=market_id,
        condition_id=condition_id,
        slug=str(raw.get("slug", "")).strip(),
        question=question,
        end_date_iso=str(raw.get("endDateIso", "")).strip(),
        yes_token_id=token_ids[yes_idx],
        no_token_id=token_ids[no_idx],
        strike_price=_extract_strike(question),
        tags=tags,
    )


class GammaMarketClient:
    def __init__(self, settings: Settings, session: aiohttp.ClientSession):
        self.settings = settings
        self.session = session

    async def fetch_btc_markets(self) -> list[MarketDefinition]:
        markets: list[MarketDefinition] = []
        offset = 0
        page_size = self.settings.gamma_page_size
        hard_limit = max(self.settings.btc_market_limit * 3, page_size)

        while offset < hard_limit and len(markets) < self.settings.btc_market_limit:
            params = {
                "limit": page_size,
                "offset": offset,
                "active": "true",
                "closed": "false",
            }
            async with self.session.get(
                self.settings.gamma_markets_url, params=params, timeout=10
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()

            if not isinstance(data, list) or not data:
                break

            for raw in data:
                if not isinstance(raw, dict):
                    continue
                if not raw.get("enableOrderBook", True):
                    continue
                if not _is_btc_market(raw, self.settings.only_15m_markets):
                    continue
                parsed = _parse_market(raw)
                if parsed is None:
                    continue
                markets.append(parsed)
                if len(markets) >= self.settings.btc_market_limit:
                    break

            if len(data) < page_size:
                break
            offset += page_size

        # De-dupe by condition + token ids.
        dedup: dict[tuple[str, str, str], MarketDefinition] = {}
        for market in markets:
            key = (market.condition_id, market.yes_token_id, market.no_token_id)
            dedup[key] = market
        return list(dedup.values())

