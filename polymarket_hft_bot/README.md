# Polymarket BTC Latency Bot (Python)

Async Python bot for BTC Polymarket contracts with:

- Gamma market discovery (BTC + optional 15m filtering)
- CLOB market websocket ingestion
- CLOB REST `/books` fallback polling for continuous scans
- External 15m forecast adapter (or internal model fallback)
- Edge detection vs live contract prices (`MIN_EDGE` default `0.3%`)
- Fast execution pipeline with worker pools, queueing, cooldowns, and rate limits
- `paper` and `live` modes
- Auto-adaptive edge threshold based on fill quality

## Reality check

- Public RPC / public internet latency means "100ms faster than everyone" is not guaranteed.
- "Thousands of trades per second" is not realistic on Polymarket CLOB due matching/rate limits/network.
- This code is optimized for fast reaction and high scan throughput, not impossible exchange throughput.

## Setup

```bash
cd /Users/arthurtoscano/Documents/New\ project/polymarket_hft_bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Run

Paper:

```bash
python run.py --env .env
```

Live:

1. Set `BOT_MODE=live`
2. Fill `POLYMARKET_PRIVATE_KEY` (+ funder/api creds if required)
3. Start with tiny `MAX_ORDER_USDC` values

```bash
python run.py --env .env
```

## External forecast format

Point `FORECAST_ENDPOINT` to any service returning JSON similar to:

```json
{
  "predicted_price_15m": 102345.12,
  "spot_price": 102120.44,
  "confidence": 0.74
}
```

Alternative payload accepted:

```json
{
  "prediction": {
    "price_15m": 102345.12,
    "spot": 102120.44,
    "score": 0.74
  }
}
```

## Strategy logic

1. Load BTC contracts.
2. Consume best bid/ask updates over websocket.
3. Build fair contract probability from 15m BTC forecast:
   - If strike price parsed in question: normal CDF vs strike.
   - Else: logistic map from predicted return.
4. Trigger trade when net edge exceeds:
   - `MIN_EDGE + FEE_BUFFER + SLIPPAGE_BUFFER`
5. Position sizing scales by edge/confidence and caps at `MAX_ORDER_USDC`.
6. Adapt `MIN_EDGE` automatically based on recent fill quality.

## Safety knobs you should tune first

- `MIN_EDGE`
- `MAX_ORDER_USDC`
- `MAX_POSITION_USDC`
- `MAX_ORDERS_PER_SECOND`
- `PER_TOKEN_COOLDOWN_MS`
- `STALE_QUOTE_MS`, `STALE_FORECAST_MS`

## Notes

- Keep keys in `.env` only. Never hardcode credentials.
- Rotate any key that has been exposed in screenshots, chat, or logs.
