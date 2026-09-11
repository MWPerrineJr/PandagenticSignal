"""Pydantic response models shared by the routers."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

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


SYMBOL_PATTERN = r"^[A-Za-z0-9.\-^=]+$"
MAX_HOLDINGS = 20


class Holding(BaseModel):
    symbol: str = Field(min_length=1, max_length=16, pattern=SYMBOL_PATTERN)
    # Exactly one of the two, and the same one for every holding in a request.
    weight: float | None = Field(default=None, gt=0)
    amount: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def _one_mode(self) -> Holding:
        if (self.weight is None) == (self.amount is None):
            raise ValueError("give either weight or amount, not both")
        return self


class PortfolioRequest(BaseModel):
    holdings: list[Holding] = Field(min_length=1, max_length=MAX_HOLDINGS)
    period: Literal["1y", "2y", "5y"] = "2y"

    @model_validator(mode="after")
    def _consistent(self) -> PortfolioRequest:
        modes = {h.weight is None for h in self.holdings}
        if len(modes) > 1:
            raise ValueError("mix of weights and amounts: use one mode for all holdings")
        symbols = [h.symbol.strip().upper() for h in self.holdings]
        if len(set(symbols)) != len(symbols):
            raise ValueError("duplicate symbols")
        return self

    def symbols_and_weights(self) -> tuple[list[str], list[float]]:
        """Upper-cased symbols and weights normalised to sum to 1 (amounts become shares)."""
        raw = [h.weight if h.weight is not None else h.amount for h in self.holdings]
        total = sum(raw)  # type: ignore[arg-type]
        return [h.symbol.strip().upper() for h in self.holdings], [float(v / total) for v in raw]  # type: ignore[operator]


class SimulateRequest(PortfolioRequest):
    horizon_years: int = Field(default=10, ge=1, le=40)
    n_sims: int = Field(default=2000, ge=100, le=10_000)
    initial_value: float = Field(default=10_000, gt=0)
    monthly_contribution: float = Field(default=0, ge=0)
    seed: int | None = Field(default=None, ge=0)


class AssetStatsOut(BaseModel):
    symbol: str
    weight: float
    annual_return: float
    annual_vol: float


class PortfolioStatsOut(BaseModel):
    symbols: list[str]
    weights: list[float]
    period: str
    start: str = Field(description="First aligned trading day, ISO date")
    end: str
    n_obs: int
    annual_return: float
    annual_vol: float
    sharpe: float
    max_drawdown: float
    assets: list[AssetStatsOut]
    correlation: list[list[float]]


class SimulationOut(BaseModel):
    initial_value: float
    horizon_years: int
    steps_per_year: int
    n_sims: int
    times: list[float] = Field(description="Years from today for each band sample")
    bands: dict[str, list[float]]
    terminal: dict[str, float]
    stats: PortfolioStatsOut


class RetirementRequest(BaseModel):
    current_age: int = Field(ge=0, le=110)
    retirement_age: int = Field(ge=1, le=110)
    life_expectancy: int = Field(ge=2, le=110)
    current_savings: float = Field(ge=0)
    monthly_contribution: float = Field(ge=0)
    expected_return: float = Field(default=0.06, ge=-0.5, le=0.5)
    inflation: float = Field(default=0.025, ge=-0.5, le=0.5)
    annual_spending: float = Field(ge=0, description="In today's dollars")
    # "parametric": expected_return + volatility. "portfolio": moments from `holdings` history.
    mode: Literal["parametric", "portfolio"] = "parametric"
    volatility: float = Field(default=0.12, ge=0, le=1)
    holdings: list[Holding] | None = Field(default=None, max_length=MAX_HOLDINGS)
    period: Literal["1y", "2y", "5y"] = "2y"
    n_sims: int = Field(default=2000, ge=100, le=10_000)
    seed: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _ages_and_mode(self) -> RetirementRequest:
        if not self.current_age < self.retirement_age < self.life_expectancy:
            raise ValueError("ages must satisfy current_age < retirement_age < life_expectancy")
        if self.mode == "portfolio":
            if not self.holdings:
                raise ValueError("portfolio mode needs holdings")
            PortfolioRequest(holdings=self.holdings, period=self.period)  # same rules
        return self


class YearPointOut(BaseModel):
    age: int
    year: int
    balance_nominal: float
    balance_real: float
    cashflow: float


class RetirementAssumptions(BaseModel):
    mu: float = Field(description="Expected annual growth used for the projection")
    sigma: float
    source: Literal["parametric", "portfolio"]
    symbols: list[str] = Field(default_factory=list)


class RetirementMonteCarlo(BaseModel):
    success_probability: float
    ages: list[int]
    bands: dict[str, list[float]] = Field(description="Real (today's dollars) percentiles by age")
    median_depletion_age: int | None
    terminal: dict[str, float]
    n_sims: int


class RetirementOut(BaseModel):
    assumptions: RetirementAssumptions
    deterministic: list[YearPointOut]
    monte_carlo: RetirementMonteCarlo


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


class LevelOut(BaseModel):
    price: float
    touches: int
    kind: Literal["support", "resistance"]


class IndicatorSeriesOut(BaseModel):
    """One computed indicator, keyed in `Indicators.series` by its canonical token."""

    id: str
    kind: Literal["overlay", "pane"]
    params: dict[str, float]
    outputs: dict[str, list[float | None]]


class Indicators(BaseModel):
    symbol: str
    period: str
    interval: str
    candles: list[Candle]
    #: Requested indicators in request order, keyed by canonical token (`rsi:14`, `bb:20-2`).
    series: dict[str, IndicatorSeriesOut]
    #: Support/resistance levels; populated only when the `sr` token is requested.
    levels: list[LevelOut]


class IndicatorParamOut(BaseModel):
    name: str
    default: float
    min: float
    max: float
    integer: bool


class IndicatorSpecOut(BaseModel):
    id: str
    name: str
    kind: Literal["overlay", "pane"]
    outputs: list[str]
    params: list[IndicatorParamOut]
    reference_lines: list[float]
    description: str
    formula: str


class IndicatorCatalog(BaseModel):
    indicators: list[IndicatorSpecOut]
    defaults: list[str]
    max_per_request: int


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


# -- news + AI sentiment (Phase 11) ------------------------------------------------------------


class NewsItem(BaseModel):
    title: str
    summary: str = ""
    published_at: str | None = None
    provider: str | None = None
    url: str | None = None


Sentiment = Literal["bullish", "neutral", "bearish"]


class ArticleSentiment(BaseModel):
    """One article's read, as produced by the model. `index` is 1-based, matching the prompt."""

    index: int
    sentiment: Sentiment
    rationale: str


class SentimentReport(BaseModel):
    """The model's structured output. Kept flat and unconstrained so the JSON schema stays
    simple for `output_format`; bounds are stated in the prompt and clamped after parsing."""

    overall: Sentiment
    score: float
    confidence: float
    themes: list[str]
    articles: list[ArticleSentiment]
    summary: str


class SentimentStatus(BaseModel):
    enabled: bool
    model: str | None = None


class SentimentArticleOut(BaseModel):
    index: int
    title: str
    provider: str | None = None
    published_at: str | None = None
    url: str | None = None
    sentiment: Sentiment | None = None
    rationale: str | None = None


class SentimentOut(BaseModel):
    symbol: str
    generated_at: int
    model: str
    cached: bool
    news_count: int
    report: SentimentReport | None
    articles: list[SentimentArticleOut]
    disclaimer: str
