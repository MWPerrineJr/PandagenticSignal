"""An in-memory stand-in for the `yfinance` module used by unit tests."""

from __future__ import annotations

import numpy as np
import pandas as pd
from yfinance import exceptions as yf_exc

from app.services.crypto import NotFound


def make_ohlc(rows: int = 30, start: float = 100.0, seed: int = 7) -> pd.DataFrame:
    """Deterministic daily OHLCV frame with a tz-aware index, like `Ticker.history` returns."""
    rng = np.random.default_rng(seed)
    closes = start + np.cumsum(rng.normal(0, 1, rows))
    opens = np.concatenate([[start], closes[:-1]])
    highs = np.maximum(opens, closes) + rng.uniform(0.1, 1.0, rows)
    lows = np.minimum(opens, closes) - rng.uniform(0.1, 1.0, rows)
    volume = rng.integers(1_000_000, 5_000_000, rows)
    index = pd.date_range("2026-01-02", periods=rows, freq="B", tz="America/New_York")
    return pd.DataFrame(
        {
            "Open": opens,
            "High": highs,
            "Low": lows,
            "Close": closes,
            "Volume": volume,
            "Dividends": 0.0,
            "Stock Splits": 0.0,
        },
        index=index,
    )


FAST_INFO = {
    "AAPL": {
        "last_price": 200.0,
        "previous_close": 190.0,
        "last_volume": 1234567,
        "market_cap": 3.0e12,
        "currency": "USD",
        "exchange": "NMS",
        "day_high": 202.5,
        "day_low": 197.0,
        "year_high": 260.0,
        "year_low": 150.0,
        "quote_type": "EQUITY",
    },
    "MSFT": {
        "last_price": 400.0,
        "previous_close": 400.0,
        "last_volume": 2000000,
        "market_cap": 3.2e12,
        "currency": "USD",
        "exchange": "NMS",
    },
    "BTC-USD": {
        "last_price": 65000.0,
        "previous_close": 64000.0,
        "last_volume": 30_000_000_000,
        "market_cap": 1.3e12,
        "currency": "USD",
        "exchange": "CCC",
        "quote_type": "CRYPTOCURRENCY",
    },
}

SEARCH_QUOTES = [
    {"symbol": "AAPL", "shortname": "Apple Inc.", "quoteType": "EQUITY", "exchDisp": "NASDAQ"},
    {"symbol": "APC.DE", "longname": "Apple Inc.", "quoteType": "EQUITY", "exchange": "GER"},
    {"symbol": "AAPL260918C00200000", "shortname": "AAPL Sep 2026 call", "quoteType": "OPTION"},
    {"symbol": "QQQ", "shortname": "Invesco QQQ Trust", "quoteType": "ETF", "exchDisp": "NASDAQ"},
    {"symbol": "", "shortname": "broken", "quoteType": "EQUITY"},
    {
        "symbol": "BTC-USD",
        "shortname": "Bitcoin USD",
        "quoteType": "CRYPTOCURRENCY",
        "exchDisp": "CCC",
    },
    {"symbol": "BTC=F", "shortname": "Bitcoin Futures", "quoteType": "FUTURE"},
]

RECOMMENDATIONS = pd.DataFrame(
    {
        "period": ["0m", "-1m"],
        "strongBuy": [6, 5],
        "buy": [18, 19],
        "hold": [13, 14],
        "sell": [3, 3],
        "strongSell": [3, 2],
    }
)
PRICE_TARGETS = {"current": 200.0, "high": 260.0, "low": 150.0, "mean": 225.5, "median": 230.0}
UPGRADES = pd.DataFrame(
    {
        "Firm": ["Morgan Stanley", "DA Davidson", "Rosenblatt", "Needham"],
        "ToGrade": ["Overweight", "Neutral", "Buy", "Hold"],
        "FromGrade": ["Overweight", "Buy", "Buy", "Hold"],
        "Action": ["main", "down", "main", "main"],
        "priceTargetAction": ["Raises", "Lowers", np.nan, "Maintains"],
        "currentPriceTarget": [370.0, 250.0, np.nan, 0.0],
        "priorPriceTarget": [360.0, 270.0, np.nan, 0.0],
    },
    index=pd.DatetimeIndex(
        [
            "2026-09-02 17:34:35",
            "2026-09-02 16:01:42",
            "2026-09-01 12:17:07",
            "2026-08-30 09:00:00",
        ],
        name="GradeDate",
    ),
)


class FakeFastInfo:
    def __init__(self, data: dict) -> None:
        self._data = data

    def __getitem__(self, key: str):
        return self._data[key]


class FakeTicker:
    """Mimics `yfinance.Ticker` for a fixed symbol table."""

    calls: list[tuple[str, str]] = []

    def __init__(self, symbol: str, yf: FakeYF) -> None:
        self.symbol = symbol
        self._yf = yf
        FakeTicker.calls.append(("Ticker", symbol))

    @property
    def fast_info(self) -> FakeFastInfo:
        self._yf.maybe_raise()
        if self.symbol not in FAST_INFO:
            raise KeyError("currentTradingPeriod")
        return FakeFastInfo(FAST_INFO[self.symbol])

    def history(self, period: str = "1mo", interval: str = "1d", **_: object) -> pd.DataFrame:
        self._yf.maybe_raise()
        FakeTicker.calls.append(("history", f"{self.symbol}:{period}:{interval}"))
        if self.symbol not in FAST_INFO:
            return pd.DataFrame()
        return make_ohlc(self._yf.history_rows)

    @property
    def recommendations_summary(self):
        self._yf.maybe_raise()
        return RECOMMENDATIONS.copy() if self.symbol == "AAPL" else None

    @property
    def analyst_price_targets(self):
        return dict(PRICE_TARGETS) if self.symbol == "AAPL" else {}

    @property
    def upgrades_downgrades(self):
        if self.symbol == "AAPL":
            return UPGRADES.copy()
        if self.symbol == "MSFT":
            raise KeyError("no grades")
        return None


class FakeSearch:
    def __init__(self, query: str, yf: FakeYF, **_: object) -> None:
        yf.maybe_raise()
        self.quotes = list(SEARCH_QUOTES) if "app" in query.lower() else []


class FakeYF:
    """Drop-in for the `yfinance` module: exposes `Ticker` and `Search`."""

    def __init__(self, *, history_rows: int = 30) -> None:
        self.history_rows = history_rows
        self.error: Exception | None = None
        FakeTicker.calls.clear()

    def maybe_raise(self) -> None:
        if self.error is not None:
            raise self.error

    def Ticker(self, symbol: str) -> FakeTicker:  # noqa: N802 - mirrors yfinance's API
        return FakeTicker(symbol, self)

    def Search(self, query: str, **kwargs: object) -> FakeSearch:  # noqa: N802
        return FakeSearch(query, self, **kwargs)

    # Convenience constructors for error scenarios.
    def fail_with_rate_limit(self) -> None:
        self.error = yf_exc.YFRateLimitError()

    def fail_with_upstream(self) -> None:
        self.error = yf_exc.YFDataException("boom")

    def fail_with_network(self) -> None:
        self.error = ConnectionError("no route to host")


# -- Coinbase + CoinGecko ---------------------------------------------------------------------

FAKE_NOW = 1_789_000_000  # 2026-09-10 UTC

COINBASE_PRODUCTS = {
    "products": [
        {
            "product_id": "BTC-USD",
            "base_currency_id": "BTC",
            "quote_currency_id": "USD",
            "base_name": "Bitcoin",
            "price": "65000",
            "price_percentage_change_24h": "1.5",
            "approximate_quote_24h_volume": "31000000000.5",
            "high_24h": "66000",
            "low_24h": "63500",
            "status": "online",
            "is_disabled": False,
            "view_only": False,
        },
        {
            "product_id": "ETH-USD",
            "base_currency_id": "ETH",
            "quote_currency_id": "USD",
            "base_name": "Ethereum",
            "price": "3200",
            "price_percentage_change_24h": "-0.75",
            "approximate_quote_24h_volume": "12000000000",
            "high_24h": "3300",
            "low_24h": "3150",
            "status": "online",
            "is_disabled": False,
            "view_only": False,
        },
        {
            "product_id": "DOGE-USD",
            "base_currency_id": "DOGE",
            "quote_currency_id": "USD",
            "base_name": "Dogecoin",
            "price": "0.1234",
            "price_percentage_change_24h": "",
            "approximate_quote_24h_volume": "",
            "high_24h": "",
            "low_24h": "",
            "status": "online",
            "is_disabled": False,
            "view_only": False,
        },
        {
            "product_id": "BTC-EUR",
            "base_currency_id": "BTC",
            "quote_currency_id": "EUR",
            "price": "1",
        },
        {
            "product_id": "OLD-USD",
            "base_currency_id": "OLD",
            "quote_currency_id": "USD",
            "price": "1",
            "status": "delisted",
        },
        {
            "product_id": "OFF-USD",
            "base_currency_id": "OFF",
            "quote_currency_id": "USD",
            "price": "1",
            "status": "online",
            "is_disabled": True,
        },
    ]
}

COINGECKO_MARKETS = [
    {
        "id": "bitcoin",
        "symbol": "btc",
        "name": "Bitcoin",
        "image": "https://img.example/btc.png",
        "current_price": 64990,
        "market_cap": 1.3e12,
        "market_cap_rank": 1,
        "total_volume": 3.3e10,
        "high_24h": 65990,
        "low_24h": 63490,
        "price_change_percentage_24h": 1.4,
        "circulating_supply": 20_000_000.0,
    },
    {
        "id": "ethereum",
        "symbol": "eth",
        "name": "Ethereum",
        "image": "https://img.example/eth.png",
        "current_price": 3199,
        "market_cap": 3.9e11,
        "market_cap_rank": 2,
        "total_volume": 1.2e10,
        "price_change_percentage_24h": -0.7,
        "circulating_supply": 120_000_000.0,
    },
    {
        "id": "tether",
        "symbol": "usdt",
        "name": "Tether",
        "image": "https://img.example/usdt.png",
        "current_price": 0.9996,
        "market_cap": 1.8e11,
        "market_cap_rank": 3,
        "total_volume": 8e10,
        "high_24h": 1.0,
        "low_24h": 0.999,
        "price_change_percentage_24h": -0.003,
        "circulating_supply": 1.83e11,
    },
    {
        "id": "dogecoin",
        "symbol": "doge",
        "name": "Dogecoin",
        "image": None,
        "current_price": 0.1233,
        "market_cap": 1.8e10,
        "market_cap_rank": 4,
        "total_volume": 9e8,
        "price_change_percentage_24h": 2.0,
        "circulating_supply": 1.5e11,
    },
    {"id": "broken", "symbol": "", "name": "No symbol", "current_price": 1},
    {"id": "nopx", "symbol": "npx", "name": "No price", "current_price": None},
]

STEP_FOR = {
    "ONE_MINUTE": 60,
    "FIVE_MINUTE": 300,
    "FIFTEEN_MINUTE": 900,
    "THIRTY_MINUTE": 1_800,
    "ONE_HOUR": 3_600,
    "ONE_DAY": 86_400,
}


def make_cb_candles(start: int, end: int, granularity: str) -> list[dict[str, str]]:
    """Newest-first candles like Coinbase returns, one per `granularity` bucket in [start, end]."""
    step = STEP_FOR[granularity]
    first = (end // step) * step
    out = []
    t = first
    while t >= start:
        close = 100.0 + (t // step) % 30
        out.append(
            {
                "start": str(t),
                "open": str(close - 0.5),
                "high": str(close + 1),
                "low": str(close - 1),
                "close": str(close),
                "volume": "10.5",
            }
        )
        t -= step
    return out


class FakeFetch:
    """Stand-in for `make_fetcher`: answers Coinbase and CoinGecko URLs from fixtures."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict | None]] = []
        self.error: Exception | None = None

    def __call__(self, url: str, params: dict | None = None):
        self.calls.append((url, params))
        if self.error is not None:
            raise self.error
        if url.endswith("/products"):
            return COINBASE_PRODUCTS
        if "/products/" in url and url.endswith("/candles"):
            product = url.split("/products/")[1].split("/")[0]
            if product not in {"BTC-USD", "ETH-USD", "DOGE-USD"}:
                raise NotFound(url)
            assert params is not None
            return {
                "candles": make_cb_candles(params["start"], params["end"], params["granularity"])
            }
        if url.endswith("/coins/markets"):
            return list(COINGECKO_MARKETS)
        raise NotFound(url)

    def urls(self, fragment: str) -> list[str]:
        return [u for u, _ in self.calls if fragment in u]
