"""An in-memory stand-in for the `yfinance` module used by unit tests."""

from __future__ import annotations

import numpy as np
import pandas as pd
from yfinance import exceptions as yf_exc


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

# Rows in the shape of `yf.screen("all_cryptocurrencies_us")["quotes"]`.
SCREEN_QUOTES = [
    {
        "symbol": "BTC-USD",
        "shortName": "Bitcoin USD",
        "regularMarketPrice": 65000.0,
        "regularMarketChangePercent": 1.5,
        "marketCap": 1.3e12,
        "regularMarketVolume": 30_000_000_000,
        "volume24Hr": 31_000_000_000,
        "circulatingSupply": 20_000_000,
    },
    {
        "symbol": "ETH-USD",
        "longName": "Ethereum USD",
        "regularMarketPrice": 3200.0,
        "regularMarketChangePercent": -0.75,
        "marketCap": 3.9e11,
        "regularMarketVolume": 12_000_000_000,
        "circulatingSupply": 120_000_000,
    },
    {"symbol": "BROKEN-USD", "shortName": "No price"},
    {
        "symbol": "SOL-USD",
        "shortName": "Solana USD",
        "regularMarketPrice": 150.0,
        "marketCap": 7e10,
    },
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

    def screen(self, query: str, count: int = 25, **_: object) -> dict:
        self.maybe_raise()
        FakeTicker.calls.append(("screen", f"{query}:{count}"))
        rows = SCREEN_QUOTES[:count] if query == "all_cryptocurrencies_us" else []
        return {"quotes": rows, "count": len(rows), "total": len(SCREEN_QUOTES)}

    # Convenience constructors for error scenarios.
    def fail_with_rate_limit(self) -> None:
        self.error = yf_exc.YFRateLimitError()

    def fail_with_upstream(self) -> None:
        self.error = yf_exc.YFDataException("boom")

    def fail_with_network(self) -> None:
        self.error = ConnectionError("no route to host")
