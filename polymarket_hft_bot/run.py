from __future__ import annotations

import argparse
import asyncio
import logging
import os

from polymarket_hft import LatencyHFTBot, load_settings


def _configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Polymarket BTC latency bot")
    parser.add_argument(
        "--env",
        default=os.path.join(os.path.dirname(__file__), ".env"),
        help="Path to .env file",
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    settings = load_settings(args.env)
    _configure_logging(settings.verbose)

    if settings.is_live and not settings.private_key:
        raise RuntimeError("Live mode requires POLYMARKET_PRIVATE_KEY")

    logging.getLogger(__name__).info(
        "starting bot mode=%s min_edge=%.4f markets<=%d",
        settings.mode,
        settings.min_edge,
        settings.btc_market_limit,
    )

    bot = LatencyHFTBot(settings)
    await bot.run()


if __name__ == "__main__":
    asyncio.run(main())

