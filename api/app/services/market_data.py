"""yfinance wrapper. Every public method is cached and raises `app.errors` exceptions only.

The yfinance module is held as an instance attribute so tests can swap in a fake.
"""

from __future__ import annotations

from typing import Any

import pandas as pd
import yfinance as yf
from yfinance import exceptions as yf_exc

from app.errors import (
    InsufficientHistoryError,
    RateLimitedError,
    TickerNotFoundError,
    UpstreamError,
)
from app.schemas import (
    Candle,
    CryptoTop,
    GradeChange,
    PriceTargets,
    Quote,
    RecommendationPeriod,
    SearchResult,
)
from app.services.cache import Cache
from app.services.convert import _int, _num, _price, _str
from app.services.crypto import CryptoData
from app.services.portfolio import InsufficientDataError, align_closes
from app.settings import Settings, get_settings

SEARCH_TYPES = {"EQUITY", "ETF", "CRYPTOCURRENCY"}
MAX_GRADE_CHANGES = 50


def normalise_ticker(ticker: str) -> str:
    return ticker.strip().upper()


def frame_to_candles(df: pd.DataFrame) -> list[Candle]:
    """Convert a yfinance history frame (tz-aware DatetimeIndex, OHLCV columns) to candles."""
    if df.empty:
        return []
    idx = pd.DatetimeIndex(df.index)
    idx = idx.tz_convert("UTC") if idx.tz is not None else idx.tz_localize("UTC")
    epoch = pd.Timestamp(0, tz="UTC")
    times = ((idx - epoch) // pd.Timedelta(seconds=1)).tolist()
    rows = df[["Open", "High", "Low", "Close", "Volume"]].to_numpy()
    candles: list[Candle] = []
    for t, (o, h, lo, c, v) in zip(times, rows, strict=True):
        if any(map(pd.isna, (o, h, lo, c))):
            continue
        candles.append(
            Candle(
                time=int(t),
                open=float(o),
                high=float(h),
                low=float(lo),
                close=float(c),
                volume=int(v) if not pd.isna(v) else 0,
            )
        )
    return candles


class MarketData:
    def __init__(
        self,
        *,
        cache: Cache | None = None,
        settings: Settings | None = None,
        yfinance_module: Any = yf,
        crypto: CryptoData | None = None,
    ) -> None:
        self.cache = cache or Cache()
        self.settings = settings or get_settings()
        self.yf = yfinance_module
        # Coinbase/CoinGecko for coins; anything Coinbase does not trade falls back to Yahoo.
        self.crypto = crypto or CryptoData(settings=self.settings)

    # -- helpers ----------------------------------------------------------------------------

    def _call(self, fn, *args, **kwargs):
        """Run a yfinance call, translating its failures into domain errors."""
        try:
            return fn(*args, **kwargs)
        except yf_exc.YFRateLimitError as exc:
            raise RateLimitedError("Yahoo Finance rate limit reached; retry shortly") from exc
        except yf_exc.YFException as exc:
            raise UpstreamError(f"Yahoo Finance error: {exc}") from exc
        except (ConnectionError, TimeoutError, OSError) as exc:
            raise UpstreamError(f"Could not reach Yahoo Finance: {exc}") from exc

    # -- search -----------------------------------------------------------------------------

    def search(self, query: str, limit: int = 8) -> list[SearchResult]:
        q = query.strip()
        if not q:
            return []
        key = (q.lower(), limit)
        return self.cache.get_or_set(
            "search", key, self.settings.search_ttl, lambda: self._search(q, limit)
        )

    def _search(self, query: str, limit: int) -> list[SearchResult]:
        result = self._call(
            self.yf.Search, query, max_results=limit * 2, news_count=0, lists_count=0
        )
        quotes = getattr(result, "quotes", None) or []
        out: list[SearchResult] = []
        for item in quotes:
            if item.get("quoteType") not in SEARCH_TYPES or not item.get("symbol"):
                continue
            out.append(
                SearchResult(
                    symbol=item["symbol"],
                    name=item.get("shortname") or item.get("longname") or item["symbol"],
                    exchange=item.get("exchDisp") or item.get("exchange"),
                    type=item["quoteType"],
                )
            )
            if len(out) >= limit:
                break
        return out

    # -- quotes -----------------------------------------------------------------------------

    def quote(self, ticker: str) -> Quote:
        symbol = normalise_ticker(ticker)
        if self.crypto.is_crypto(symbol):
            return self.crypto.quote(symbol)
        return self.cache.get_or_set(
            "quote", symbol, self.settings.quote_ttl, lambda: self._quote(symbol)
        )

    def _quote(self, symbol: str) -> Quote:
        t = self._call(self.yf.Ticker, symbol)
        try:
            info = self._call(lambda: t.fast_info)
            price = _num(info["last_price"])
        except (KeyError, AttributeError, TypeError):
            raise TickerNotFoundError(symbol) from None
        if price is None:
            raise TickerNotFoundError(symbol)

        def get(field: str) -> Any:
            try:
                return info[field]
            except (KeyError, AttributeError, TypeError):
                return None

        previous_close = _num(get("previous_close"))
        change = price - previous_close if previous_close is not None else None
        change_pct = (
            change / previous_close * 100 if change is not None and previous_close else None
        )
        return Quote(
            symbol=symbol,
            price=price,
            previous_close=previous_close,
            change=change,
            change_pct=change_pct,
            volume=_int(get("last_volume")),
            market_cap=_num(get("market_cap")),
            currency=_str(get("currency")),
            exchange=_str(get("exchange")),
            day_high=_num(get("day_high")),
            day_low=_num(get("day_low")),
            year_high=_num(get("year_high")),
            year_low=_num(get("year_low")),
            quote_type=_str(get("quote_type")),
        )

    def quotes(self, tickers: list[str]) -> tuple[list[Quote], list[str]]:
        found: list[Quote] = []
        missing: list[str] = []
        seen: set[str] = set()
        for raw in tickers:
            symbol = normalise_ticker(raw)
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            try:
                found.append(self.quote(symbol))
            except TickerNotFoundError:
                missing.append(symbol)
        return found, missing

    # -- crypto -----------------------------------------------------------------------------

    def top_crypto(self, limit: int = 25) -> CryptoTop:
        """Top coins: CoinGecko ranking with Coinbase prices (see `services.crypto`)."""
        return self.crypto.top(limit)

    # -- history ----------------------------------------------------------------------------

    def history(self, ticker: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
        symbol = normalise_ticker(ticker)
        if self.crypto.is_crypto(symbol):
            return self.crypto.history(symbol, period, interval)
        key = (symbol, period, interval)
        df = self.cache.get_or_set(
            "history",
            key,
            self.settings.history_ttl,
            lambda: self._history(symbol, period, interval),
        )
        return df.copy()

    def _history(self, symbol: str, period: str, interval: str) -> pd.DataFrame:
        t = self._call(self.yf.Ticker, symbol)
        df = self._call(t.history, period=period, interval=interval, auto_adjust=True)
        if df is None or df.empty:
            raise TickerNotFoundError(symbol)
        return df

    def closes(self, symbols: list[str], period: str = "2y") -> pd.DataFrame:
        """Aligned daily closes for several symbols (stocks and coins), one column each.

        Indexes are normalised to calendar dates so Yahoo's exchange-local midnights and
        Coinbase's UTC midnights line up; the join keeps only days every asset traded.
        """
        frames: dict[str, pd.Series] = {}
        for raw in symbols:
            symbol = normalise_ticker(raw)
            df = self.history(symbol, period=period, interval="1d")
            idx = pd.DatetimeIndex(df.index)
            idx = idx.tz_convert("UTC") if idx.tz is not None else idx.tz_localize("UTC")
            dates = idx.normalize().tz_localize(None)
            close = pd.Series(df["Close"].to_numpy(dtype=float), index=dates)
            frames[symbol] = close[~close.index.duplicated(keep="last")]
        try:
            return align_closes(frames)
        except InsufficientDataError as exc:
            raise InsufficientHistoryError(str(exc)) from exc

    # -- recommendations --------------------------------------------------------------------

    def recommendations(self, ticker: str) -> dict[str, Any]:
        symbol = normalise_ticker(ticker)
        return self.cache.get_or_set(
            "recommendations",
            symbol,
            self.settings.recommendations_ttl,
            lambda: self._recommendations(symbol),
        )

    def _recommendations(self, symbol: str) -> dict[str, Any]:
        t = self._call(self.yf.Ticker, symbol)
        summary_df = self._optional(lambda: t.recommendations_summary)
        targets = self._optional(lambda: t.analyst_price_targets) or {}
        grades_df = self._optional(lambda: t.upgrades_downgrades)

        summary = [
            RecommendationPeriod(
                period=str(row["period"]),
                strong_buy=_int(row.get("strongBuy")) or 0,
                buy=_int(row.get("buy")) or 0,
                hold=_int(row.get("hold")) or 0,
                sell=_int(row.get("sell")) or 0,
                strong_sell=_int(row.get("strongSell")) or 0,
            )
            for _, row in (summary_df.iterrows() if isinstance(summary_df, pd.DataFrame) else [])
        ]
        if not summary and not targets and not isinstance(grades_df, pd.DataFrame):
            # Nothing at all: make sure the symbol exists before answering with empties.
            self.quote(symbol)

        grades: list[GradeChange] = []
        if isinstance(grades_df, pd.DataFrame) and not grades_df.empty:
            head = grades_df.sort_index(ascending=False).head(MAX_GRADE_CHANGES)
            for when, row in head.iterrows():
                grades.append(
                    GradeChange(
                        date=pd.Timestamp(when).isoformat(),
                        firm=_str(row.get("Firm")) or "",
                        to_grade=_str(row.get("ToGrade")),
                        from_grade=_str(row.get("FromGrade")),
                        action=_str(row.get("Action")),
                        price_target_action=_str(row.get("priceTargetAction")),
                        current_price_target=_price(row.get("currentPriceTarget")),
                        prior_price_target=_price(row.get("priorPriceTarget")),
                    )
                )
        return {
            "symbol": symbol,
            "summary": summary,
            "price_targets": PriceTargets(
                **{k: _price(targets.get(k)) for k in PriceTargets.model_fields}
            ),
            "upgrades_downgrades": grades,
        }

    def _optional(self, fn):
        """Fetch an analyst dataset that may be absent (ETFs, small caps). Missing → None."""
        try:
            return self._call(fn)
        except UpstreamError:
            return None
        except (KeyError, AttributeError, TypeError, ValueError):
            return None
