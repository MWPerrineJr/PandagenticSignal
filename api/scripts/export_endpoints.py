"""Write the API endpoint table to `src/content/endpoints.json` for the FAQ page.

Run from `api/`: `uv run python scripts/export_endpoints.py`. The unit test
`test_endpoints_fixture_is_current` fails when the file is stale, so the FAQ cannot describe an
API that no longer exists. Paths, methods and summaries come from the OpenAPI schema; caching and
rate-limit notes come from the table below plus the `Settings` defaults.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app  # noqa: E402
from app.settings import Settings  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "src" / "content" / "endpoints.json"

# path -> (purpose, cache description keys, rate-limit setting name)
NOTES: dict[str, tuple[str, list[str], str]] = {
    "/health": ("Liveness check used by the host", [], "none"),
    "/search": ("Symbol and company search (stocks, ETFs, crypto)", ["search_ttl"], "rate_limit"),
    "/quote/{ticker}": ("Latest price, change, ranges, market cap", ["quote_ttl"], "rate_limit"),
    "/quotes": ("Batch quotes for the watchlist", ["quote_ttl"], "rate_limit"),
    "/history/{ticker}": ("OHLCV candles for a period and interval", ["history_ttl"], "rate_limit"),
    "/indicators/catalog": ("The 20 indicators with parameters and formulas", [], "rate_limit"),
    "/indicators/{ticker}": (
        "Candles plus up to eight requested indicators",
        ["history_ttl"],
        "rate_limit",
    ),
    "/recommendations/{ticker}": (
        "Analyst ratings, price targets, upgrades/downgrades",
        ["recommendations_ttl"],
        "rate_limit",
    ),
    "/crypto/top": (
        "Top coins by market cap (CoinGecko ranking, Coinbase prices)",
        ["crypto_ttl", "coingecko_ttl"],
        "rate_limit",
    ),
    "/portfolio/analyse": (
        "Risk/return statistics and correlation for a set of holdings",
        ["history_ttl"],
        "rate_limit",
    ),
    "/portfolio/simulate": (
        "Correlated Monte Carlo projection of a portfolio",
        ["history_ttl"],
        "simulate_rate_limit",
    ),
    "/retirement/project": (
        "Deterministic and Monte Carlo retirement projection",
        ["history_ttl"],
        "simulate_rate_limit",
    ),
    "/sentiment/status": ("Whether AI sentiment is configured, and the model", [], "rate_limit"),
    "/sentiment/{ticker}": (
        "Claude's read of recent news tone for a symbol",
        ["news_ttl", "sentiment_ttl"],
        "sentiment_rate_limit",
    ),
}

CACHE_LABELS = {
    "search_ttl": "search results",
    "quote_ttl": "quotes",
    "history_ttl": "candles",
    "recommendations_ttl": "analyst data",
    "crypto_ttl": "coin prices",
    "coingecko_ttl": "market-cap ranking",
    "news_ttl": "headlines",
    "sentiment_ttl": "sentiment report",
}


def endpoints_json() -> str:
    settings = Settings()
    spec = create_app(settings).openapi()
    rows = []
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            purpose, cache_keys, limit_key = NOTES.get(
                path, (op.get("summary", ""), [], "rate_limit")
            )
            rows.append(
                {
                    "method": method.upper(),
                    "path": path,
                    "tag": (op.get("tags") or [""])[0],
                    "purpose": purpose,
                    "cache": [
                        {"what": CACHE_LABELS[k], "seconds": getattr(settings, k)}
                        for k in cache_keys
                    ],
                    "rate_limit": None if limit_key == "none" else getattr(settings, limit_key),
                }
            )
    payload = {
        "api_version": spec["info"]["version"],
        "rate_limit_default": settings.rate_limit,
        "endpoints": rows,
    }
    return json.dumps(payload, indent=2, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_text(endpoints_json())
    print(f"wrote {FIXTURE}")
