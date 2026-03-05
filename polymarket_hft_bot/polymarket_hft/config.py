from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(slots=True)
class Settings:
    mode: str
    clob_host: str
    clob_ws_market_url: str
    gamma_markets_url: str
    gamma_page_size: int
    btc_market_limit: int
    only_15m_markets: bool
    forecast_endpoint: str
    forecast_poll_ms: int
    forecast_timeout_ms: int
    min_edge: float
    fee_buffer: float
    slippage_buffer: float
    expected_15m_volatility: float
    price_floor: float
    price_ceiling: float
    max_order_usdc: float
    max_position_usdc: float
    max_orders_per_second: int
    per_token_cooldown_ms: int
    strategy_workers: int
    execution_workers: int
    stale_quote_ms: int
    stale_forecast_ms: int
    rest_fallback_enabled: bool
    rest_fallback_poll_ms: int
    rest_fallback_batch_size: int
    paper_starting_cash: float
    paper_fill_bps: float
    chain_id: int
    signature_type: int
    private_key: str
    funder_address: str
    api_key: str
    api_secret: str
    api_passphrase: str
    verbose: bool
    auto_adapt: bool
    adapt_every_trades: int
    min_edge_floor: float
    min_edge_cap: float

    @property
    def is_live(self) -> bool:
        return self.mode.lower() == "live"


def load_settings(dotenv_path: Optional[str] = None) -> Settings:
    load_dotenv(dotenv_path=dotenv_path)
    return Settings(
        mode=os.getenv("BOT_MODE", "paper"),
        clob_host=os.getenv("CLOB_HOST", "https://clob.polymarket.com"),
        clob_ws_market_url=os.getenv(
            "CLOB_WS_MARKET_URL",
            "wss://ws-subscriptions-clob.polymarket.com/ws/market",
        ),
        gamma_markets_url=os.getenv(
            "GAMMA_MARKETS_URL", "https://gamma-api.polymarket.com/markets"
        ),
        gamma_page_size=_env_int("GAMMA_PAGE_SIZE", 200),
        btc_market_limit=_env_int("BTC_MARKET_LIMIT", 150),
        only_15m_markets=_env_bool("ONLY_15M_MARKETS", True),
        forecast_endpoint=os.getenv("FORECAST_ENDPOINT", "").strip(),
        forecast_poll_ms=_env_int("FORECAST_POLL_MS", 1000),
        forecast_timeout_ms=_env_int("FORECAST_TIMEOUT_MS", 300),
        min_edge=_env_float("MIN_EDGE", 0.003),
        fee_buffer=_env_float("FEE_BUFFER", 0.0012),
        slippage_buffer=_env_float("SLIPPAGE_BUFFER", 0.0008),
        expected_15m_volatility=_env_float("EXPECTED_15M_VOLATILITY", 0.0045),
        price_floor=_env_float("PRICE_FLOOR", 0.03),
        price_ceiling=_env_float("PRICE_CEILING", 0.97),
        max_order_usdc=_env_float("MAX_ORDER_USDC", 12.0),
        max_position_usdc=_env_float("MAX_POSITION_USDC", 300.0),
        max_orders_per_second=_env_int("MAX_ORDERS_PER_SECOND", 50),
        per_token_cooldown_ms=_env_int("PER_TOKEN_COOLDOWN_MS", 150),
        strategy_workers=_env_int("STRATEGY_WORKERS", 6),
        execution_workers=_env_int("EXECUTION_WORKERS", 4),
        stale_quote_ms=_env_int("STALE_QUOTE_MS", 1500),
        stale_forecast_ms=_env_int("STALE_FORECAST_MS", 2500),
        rest_fallback_enabled=_env_bool("REST_FALLBACK_ENABLED", True),
        rest_fallback_poll_ms=_env_int("REST_FALLBACK_POLL_MS", 500),
        rest_fallback_batch_size=_env_int("REST_FALLBACK_BATCH_SIZE", 40),
        paper_starting_cash=_env_float("PAPER_STARTING_CASH", 5000.0),
        paper_fill_bps=_env_float("PAPER_FILL_BPS", 1.0),
        chain_id=_env_int("CHAIN_ID", 137),
        signature_type=_env_int("SIGNATURE_TYPE", 2),
        private_key=os.getenv("POLYMARKET_PRIVATE_KEY", "").strip(),
        funder_address=os.getenv("POLYMARKET_FUNDER", "").strip(),
        api_key=os.getenv("POLYMARKET_API_KEY", "").strip(),
        api_secret=os.getenv("POLYMARKET_API_SECRET", "").strip(),
        api_passphrase=os.getenv("POLYMARKET_API_PASSPHRASE", "").strip(),
        verbose=_env_bool("VERBOSE_LOGS", True),
        auto_adapt=_env_bool("AUTO_ADAPT", True),
        adapt_every_trades=_env_int("ADAPT_EVERY_TRADES", 30),
        min_edge_floor=_env_float("MIN_EDGE_FLOOR", 0.0015),
        min_edge_cap=_env_float("MIN_EDGE_CAP", 0.012),
    )
