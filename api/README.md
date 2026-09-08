# Stock Analysis API

FastAPI service wrapping [yfinance](https://github.com/ranaroussi/yfinance). All responses are
JSON and cached in-process with per-endpoint TTLs (`app/settings.py`, env prefix `STOCK_API_`).

```bash
uv sync
uv run uvicorn app.main:app --reload     # http://localhost:8000, interactive docs at /docs
uv run pytest --cov                      # unit tests, no network
uv run pytest -m integration             # live tests against Yahoo Finance
```

## Endpoints

| Route | Returns | TTL |
|---|---|---|
| `GET /health` | `{status: "ok"}` | – |
| `GET /search?q=apple&limit=8` | `[{symbol, name, exchange, type}]`, equities and ETFs only | 24h |
| `GET /quote/{ticker}` | price, previous close, change, change %, volume, market cap, day/year range | 60s |
| `GET /quotes?tickers=AAPL,MSFT` | `{quotes: [...], missing: [...]}` for watchlist rows (max 50) | 60s |
| `GET /history/{ticker}?period=1y&interval=1d` | `{symbol, period, interval, candles: [{time, open, high, low, close, volume}]}`; `time` is Unix seconds UTC | 5m |
| `GET /indicators/{ticker}?period&interval` | history plus `ema` (spans 10/30/60/90), `bollinger` (20, 2σ), `levels` (support/resistance) | 5m |
| `GET /recommendations/{ticker}` | analyst `summary` by month, `price_targets`, latest 50 `upgrades_downgrades` | 1h |

Series in `/indicators` are aligned index-for-index with `candles`; values are `null` until the
indicator has enough data.

## Errors

| Status | Cause |
|---|---|
| 404 | Yahoo has no data for the symbol (`{"detail": "Unknown ticker: X"}`) |
| 422 | Invalid query parameter, e.g. unsupported `period` or `interval` |
| 502 | yfinance raised or the network failed |
| 503 | Yahoo rate limit reached (`Retry-After: 30`) |

## Layout

```
app/main.py            create_app(): CORS, exception handlers, routers
app/settings.py        pydantic-settings (STOCK_API_* env vars)
app/deps.py            get_market_data() dependency (override in tests)
app/errors.py          domain exceptions mapped to HTTP status codes
app/schemas.py         Pydantic response models
app/routers/           search, quotes, history (+indicators), recommendations
app/services/cache.py        namespaced TTL cache (cachetools)
app/services/indicators.py   ema, sma, bollinger (pure pandas)
app/services/levels.py       support_resistance (scipy extrema + clustering)
app/services/market_data.py  yfinance wrapper, error translation, caching
tests/fakes.py         in-memory yfinance stand-in used by the unit tests
```
