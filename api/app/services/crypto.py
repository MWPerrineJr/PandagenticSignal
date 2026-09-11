"""Crypto market data from two public, keyless APIs.

* **Coinbase** (Advanced Trade public market endpoints): live prices, 24 h change/volume/range and
  OHLCV candles for every USD spot product. Used for quotes, charts and indicators of any symbol
  that is a Coinbase product (`BTC-USD`, `ETH-USD`, ...).
* **CoinGecko** (`/coins/markets`): the market-cap ranking, market cap, circulating supply, names
  and icons for the top-coins table. Coins not traded on Coinbase keep CoinGecko's price.

Every public method is cached and raises `app.errors` exceptions only. The HTTP fetcher is
injectable so unit tests never touch the network.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import httpx
import pandas as pd

from app.errors import RateLimitedError, TickerNotFoundError, UpstreamError
from app.schemas import CryptoQuote, CryptoTop, Quote
from app.services.cache import Cache
from app.services.convert import _int, _num, _str
from app.settings import Settings, get_settings

FetchJson = Callable[[str, dict[str, Any] | None], Any]
Clock = Callable[[], float]

QUOTE_CCY = "USD"
MAX_CRYPTO = 100
# Coinbase rejects requests for 350+ candles; keep a margin.
CANDLES_PER_REQUEST = 300
# Longest window we will page through (most recent candles win).
MAX_CANDLE_REQUESTS = 12
DAY = 86_400

# Chart interval -> (Coinbase granularity, seconds per candle). Weekly/monthly are resampled
# from daily candles, which Coinbase does not offer directly.
GRANULARITY: dict[str, tuple[str, int]] = {
    "1m": ("ONE_MINUTE", 60),
    "5m": ("FIVE_MINUTE", 300),
    "15m": ("FIFTEEN_MINUTE", 900),
    "30m": ("THIRTY_MINUTE", 1_800),
    "1h": ("ONE_HOUR", 3_600),
    "1d": ("ONE_DAY", DAY),
    "1wk": ("ONE_DAY", DAY),
    "1mo": ("ONE_DAY", DAY),
}
RESAMPLE = {"1wk": "W", "1mo": "MS"}
PERIOD_SECONDS = {
    "1d": DAY,
    "5d": 5 * DAY,
    "1mo": 30 * DAY,
    "3mo": 91 * DAY,
    "6mo": 182 * DAY,
    "1y": 365 * DAY,
    "2y": 730 * DAY,
    "5y": 5 * 365 * DAY,
    "10y": 10 * 365 * DAY,
    "max": 10 * 365 * DAY,
}
OHLCV_AGG = {"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"}


class NotFound(LookupError):
    """The upstream answered 404 for this resource."""


STALE_MARKETS_MAX_AGE = 24 * 60 * 60
log = logging.getLogger(__name__)


def make_fetcher(settings: Settings, transport: httpx.BaseTransport | None = None) -> FetchJson:
    """HTTP GET returning parsed JSON, with upstream failures mapped to domain errors."""
    client = httpx.Client(
        timeout=settings.http_timeout,
        transport=transport,
        headers={
            "User-Agent": "PandagenticSignal/0.2 (+https://pandagenticsignal.com)",
            "Accept": "application/json",
        },
    )

    def fetch(url: str, params: dict[str, Any] | None = None) -> Any:
        host = httpx.URL(url).host
        headers = None
        if settings.coingecko_api_key and url.startswith(settings.coingecko_api_url):
            headers = {"x-cg-demo-api-key": settings.coingecko_api_key}
        try:
            response = client.get(url, params=params, headers=headers)
        except httpx.HTTPError as exc:
            raise UpstreamError(f"Could not reach {host}: {exc}") from exc
        if response.status_code == 404:
            raise NotFound(url)
        if response.status_code == 429:
            raise RateLimitedError(f"{host} rate limit reached; retry shortly")
        if response.status_code >= 400:
            raise UpstreamError(f"{host} returned {response.status_code}: {response.text[:200]}")
        try:
            return response.json()
        except ValueError as exc:
            raise UpstreamError(f"{host} returned malformed JSON") from exc

    return fetch


def base_symbol(symbol: str) -> str | None:
    """`BTC-USD` -> `BTC`; anything not quoted in USD -> None (never a Coinbase lookup)."""
    s = symbol.strip().upper()
    suffix = f"-{QUOTE_CCY}"
    return s[: -len(suffix)] if s.endswith(suffix) and len(s) > len(suffix) else None


class CryptoData:
    def __init__(
        self,
        *,
        cache: Cache | None = None,
        settings: Settings | None = None,
        fetch_json: FetchJson | None = None,
        now: Clock = time.time,
    ) -> None:
        self.settings = settings or get_settings()
        # Own cache: its lock must not serialise the (slower) yfinance calls in MarketData.
        self.cache = cache or Cache()
        self._stale_markets: tuple[int, list[dict[str, Any]]] | None = None
        self.fetch = fetch_json or make_fetcher(self.settings)
        self.now = now

    def _cb(self, path: str) -> str:
        return f"{self.settings.coinbase_api_url}{path}"

    def _cg(self, path: str) -> str:
        return f"{self.settings.coingecko_api_url}{path}"

    # -- Coinbase products (one list call serves membership checks and every quote) ----------

    def products(self) -> dict[str, dict[str, Any]]:
        """Online USD spot products keyed by base currency, with their live 24 h stats."""
        return self.cache.get_or_set(
            "cb_products", QUOTE_CCY, self.settings.crypto_ttl, self._products
        )

    def _products(self) -> dict[str, dict[str, Any]]:
        data = self.fetch(self._cb("/products"), {"product_type": "SPOT"})
        rows = data.get("products") if isinstance(data, dict) else None
        out: dict[str, dict[str, Any]] = {}
        for p in rows or []:
            base = _str(p.get("base_currency_id"))
            if (
                not base
                or p.get("quote_currency_id") != QUOTE_CCY
                or p.get("status") != "online"
                or p.get("is_disabled")
                or p.get("view_only")
            ):
                continue
            out[base] = {
                "product_id": p.get("product_id") or f"{base}-{QUOTE_CCY}",
                "name": _str(p.get("base_name")) or base,
                "price": _num(p.get("price")),
                "change_pct": _num(p.get("price_percentage_change_24h")),
                "volume_usd": _num(p.get("approximate_quote_24h_volume")),
                "high_24h": _num(p.get("high_24h")),
                "low_24h": _num(p.get("low_24h")),
            }
        return out

    def is_crypto(self, symbol: str) -> bool:
        """True when Coinbase trades this USD pair; network trouble reads as False (fallback)."""
        base = base_symbol(symbol)
        if base is None:
            return False
        try:
            return base in self.products()
        except (UpstreamError, RateLimitedError):
            return False

    # -- quotes -----------------------------------------------------------------------------

    def quote(self, symbol: str) -> Quote:
        symbol = symbol.strip().upper()
        return self.cache.get_or_set(
            "cb_quote", symbol, self.settings.quote_ttl, lambda: self._quote(symbol)
        )

    def _quote(self, symbol: str) -> Quote:
        base = base_symbol(symbol)
        product = self.products().get(base) if base else None
        if product is None or product["price"] is None:
            raise TickerNotFoundError(symbol)
        price: float = product["price"]
        pct: float | None = product["change_pct"]
        previous = price / (1 + pct / 100) if pct is not None and pct > -100 else None
        change = price - previous if previous is not None else None

        year_high = year_low = None
        try:
            df = self.history(symbol, "1y", "1d")
            if not df.empty:
                year_high, year_low = float(df["High"].max()), float(df["Low"].min())
        except (UpstreamError, RateLimitedError, TickerNotFoundError):
            pass

        return Quote(
            symbol=symbol,
            price=price,
            previous_close=previous,
            change=change,
            change_pct=pct,
            volume=_int(product["volume_usd"]),
            market_cap=self._market_cap(base),
            currency=QUOTE_CCY,
            exchange="Coinbase",
            day_high=product["high_24h"],
            day_low=product["low_24h"],
            year_high=year_high,
            year_low=year_low,
            quote_type="CRYPTOCURRENCY",
        )

    def _market_cap(self, base: str | None) -> float | None:
        try:
            rows = self._markets()
        except (UpstreamError, RateLimitedError):
            return None
        for row in rows:
            if (_str(row.get("symbol")) or "").upper() == base:
                return _num(row.get("market_cap"))
        return None

    # -- history ----------------------------------------------------------------------------

    def history(self, symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
        symbol = symbol.strip().upper()
        key = (symbol, period, interval)
        df = self.cache.get_or_set(
            "cb_history",
            key,
            self.settings.history_ttl,
            lambda: self._history(symbol, period, interval),
        )
        return df.copy()

    def _period_start(self, period: str, now: int) -> int:
        if period == "ytd":
            year = datetime.fromtimestamp(now, tz=UTC).year
            return int(datetime(year, 1, 1, tzinfo=UTC).timestamp())
        return now - PERIOD_SECONDS[period]

    def _history(self, symbol: str, period: str, interval: str) -> pd.DataFrame:
        granularity, step = GRANULARITY[interval]
        now = int(self.now())
        span = CANDLES_PER_REQUEST * step
        start = max(self._period_start(period, now), now - MAX_CANDLE_REQUESTS * span)
        rows: list[dict[str, Any]] = []
        end = now
        while end > start:
            chunk_start = max(start, end - span)
            try:
                data = self.fetch(
                    self._cb(f"/products/{symbol}/candles"),
                    {"start": chunk_start, "end": end, "granularity": granularity},
                )
            except NotFound:
                raise TickerNotFoundError(symbol) from None
            rows.extend((data.get("candles") if isinstance(data, dict) else None) or [])
            end = chunk_start
        if not rows:
            raise TickerNotFoundError(symbol)

        frame = pd.DataFrame(
            {
                "time": [int(c["start"]) for c in rows],
                "Open": [float(c["open"]) for c in rows],
                "High": [float(c["high"]) for c in rows],
                "Low": [float(c["low"]) for c in rows],
                "Close": [float(c["close"]) for c in rows],
                "Volume": [float(c.get("volume") or 0) for c in rows],
            }
        )
        frame = frame.drop_duplicates("time").sort_values("time")
        index = pd.DatetimeIndex(pd.to_datetime(frame.pop("time"), unit="s", utc=True), name="Date")
        df = frame.set_index(index)
        rule = RESAMPLE.get(interval)
        if rule:
            df = df.resample(rule).agg(OHLCV_AGG).dropna(subset=["Open"])
        return df

    # -- top coins --------------------------------------------------------------------------

    def _markets(self) -> list[dict[str, Any]]:
        """CoinGecko's top coins by market cap (one page, cached).

        CoinGecko's keyless tier is throttled per source IP, which a hosted API shares with
        strangers, so a fresh fetch fails now and then. Ranking and market cap move slowly:
        when the fetch fails and a copy from the last `STALE_MARKETS_MAX_AGE` exists, serve it
        (Coinbase prices stay live) rather than blanking the crypto tab.
        """
        try:
            return self.cache.get_or_set(
                "cg_markets", QUOTE_CCY, self.settings.crypto_ttl, self._fetch_markets
            )
        except (RateLimitedError, UpstreamError) as exc:
            stale = self._stale_markets
            if stale is None or self.now() - stale[0] > STALE_MARKETS_MAX_AGE:
                raise
            age = int(self.now() - stale[0])
            log.warning("CoinGecko unavailable (%s); serving ranking from %ds ago", exc, age)
            return stale[1]

    def _fetch_markets(self) -> list[dict[str, Any]]:
        def fetch() -> list[dict[str, Any]]:
            data = self.fetch(
                self._cg("/coins/markets"),
                {
                    "vs_currency": QUOTE_CCY.lower(),
                    "order": "market_cap_desc",
                    "per_page": MAX_CRYPTO,
                    "page": 1,
                    "sparkline": "false",
                },
            )
            if not isinstance(data, list):
                raise UpstreamError("CoinGecko returned an unexpected payload")
            return data

        data = fetch()
        self._stale_markets = (int(self.now()), data)
        return data

    def top(self, limit: int = 25) -> CryptoTop:
        limit = max(1, min(int(limit), MAX_CRYPTO))
        return self.cache.get_or_set(
            "crypto_top", limit, self.settings.crypto_ttl, lambda: self._top(limit)
        )

    def _top(self, limit: int) -> CryptoTop:
        rows = self._markets()
        try:
            products = self.products()
        except (UpstreamError, RateLimitedError):
            products = {}  # ranking still works; prices come from CoinGecko
        coins: list[CryptoQuote] = []
        for row in rows:
            base = (_str(row.get("symbol")) or "").upper()
            if not base:
                continue
            product = products.get(base)
            if product and product["price"] is not None:
                price, pct = product["price"], product["change_pct"]
                volume, high, low = product["volume_usd"], product["high_24h"], product["low_24h"]
                source = "coinbase"
            else:
                price = _num(row.get("current_price"))
                if price is None:
                    continue
                pct = _num(row.get("price_change_percentage_24h"))
                volume, high, low = (
                    _num(row.get("total_volume")),
                    _num(row.get("high_24h")),
                    _num(row.get("low_24h")),
                )
                source = "coingecko"
            coins.append(
                CryptoQuote(
                    symbol=f"{base}-{QUOTE_CCY}",
                    name=_str(row.get("name")) or base,
                    price=price,
                    change_pct=pct,
                    market_cap=_num(row.get("market_cap")),
                    volume=volume,
                    circulating_supply=_num(row.get("circulating_supply")),
                    rank=_int(row.get("market_cap_rank")),
                    icon=_str(row.get("image")),
                    high_24h=high,
                    low_24h=low,
                    price_source=source,
                )
            )
            if len(coins) >= limit:
                break
        return CryptoTop(as_of=int(self.now()), coins=coins)
