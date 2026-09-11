"""Pydantic response models shared by the routers."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Period = Literal["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]
Interval = Literal["1m", "5m", "15m", "30m", "1h", "1d", "1wk", "1mo"]


class SearchResult(BaseModel):
    symbol: str
    name: str
    exchange: str | None = None
    type: str


class Quote(BaseModel):
    symbol: str
    price: float
    previous_close: float | None = None
    change: float | None = None
    change_pct: float | None = None
    volume: int | None = None
    market_cap: float | None = None
    currency: str | None = None
    exchange: str | None = None
    day_high: float | None = None
    day_low: float | None = None
    year_high: float | None = None
    year_low: float | None = None
    # Yahoo quoteType: EQUITY, ETF, CRYPTOCURRENCY, ...
    quote_type: str | None = None


class QuoteBatch(BaseModel):
    quotes: list[Quote]
    missing: list[str] = Field(default_factory=list)


class CryptoQuote(BaseModel):
    symbol: str
    name: str
    price: float
    change_pct: float | None = None
    market_cap: float | None = None
    volume: float | None = None
    circulating_supply: float | None = None
    rank: int | None = None
    icon: str | None = None
    high_24h: float | None = None
    low_24h: float | None = None
    # "coinbase" when the pair trades on Coinbase, else CoinGecko's price.
    price_source: Literal["coinbase", "coingecko"] = "coinbase"


class CryptoTop(BaseModel):
    as_of: int = Field(description="Unix epoch seconds (UTC) when the list was fetched")
    coins: list[CryptoQuote]


class Candle(BaseModel):
    time: int = Field(description="Unix epoch seconds (UTC)")
    open: float
    high: float
    low: float
    close: float
    volume: int


class History(BaseModel):
    symbol: str
    period: str
    interval: str
    candles: list[Candle]


class BollingerSeries(BaseModel):
    window: int
    k: float
    middle: list[float | None]
    upper: list[float | None]
    lower: list[float | None]


class LevelOut(BaseModel):
    price: float
    touches: int
    kind: Literal["support", "resistance"]


class Indicators(BaseModel):
    symbol: str
    period: str
    interval: str
    candles: list[Candle]
    ema: dict[str, list[float | None]]
    bollinger: BollingerSeries
    levels: list[LevelOut]


class RecommendationPeriod(BaseModel):
    period: str
    strong_buy: int
    buy: int
    hold: int
    sell: int
    strong_sell: int


class PriceTargets(BaseModel):
    current: float | None = None
    high: float | None = None
    low: float | None = None
    mean: float | None = None
    median: float | None = None


class GradeChange(BaseModel):
    date: str
    firm: str
    to_grade: str | None = None
    from_grade: str | None = None
    action: str | None = None
    price_target_action: str | None = None
    current_price_target: float | None = None
    prior_price_target: float | None = None


class Recommendations(BaseModel):
    symbol: str
    summary: list[RecommendationPeriod]
    price_targets: PriceTargets
    upgrades_downgrades: list[GradeChange]
