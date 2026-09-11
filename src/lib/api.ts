/**
 * Typed client for the FastAPI service. Zod schemas mirror `api/app/schemas.py`
 * so a drifting backend fails loudly at the boundary instead of deep in a component.
 */
import { z } from 'zod'

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

export const PERIODS = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'] as const
export const INTERVALS = ['1m', '5m', '15m', '30m', '1h', '1d', '1wk', '1mo'] as const
export type Period = (typeof PERIODS)[number]
export type Interval = (typeof INTERVALS)[number]

const nullableNumber = z.number().nullable()
const nullableString = z.string().nullable()

export const searchResultSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  exchange: nullableString.optional(),
  type: z.string(),
})
export type SearchResult = z.infer<typeof searchResultSchema>

export const quoteSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  previous_close: nullableNumber.optional(),
  change: nullableNumber.optional(),
  change_pct: nullableNumber.optional(),
  volume: nullableNumber.optional(),
  market_cap: nullableNumber.optional(),
  currency: nullableString.optional(),
  exchange: nullableString.optional(),
  day_high: nullableNumber.optional(),
  day_low: nullableNumber.optional(),
  year_high: nullableNumber.optional(),
  year_low: nullableNumber.optional(),
  /** Yahoo quoteType: EQUITY, ETF, CRYPTOCURRENCY, ... */
  quote_type: nullableString.optional(),
})
export type Quote = z.infer<typeof quoteSchema>
export const isCryptoQuote = (quote: Pick<Quote, 'quote_type'> | null | undefined): boolean =>
  quote?.quote_type === 'CRYPTOCURRENCY'

export const quoteBatchSchema = z.object({
  quotes: z.array(quoteSchema),
  missing: z.array(z.string()),
})
export type QuoteBatch = z.infer<typeof quoteBatchSchema>

export const cryptoQuoteSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  change_pct: nullableNumber.optional(),
  market_cap: nullableNumber.optional(),
  volume: nullableNumber.optional(),
  circulating_supply: nullableNumber.optional(),
  rank: z.number().int().nullable().optional(),
  icon: nullableString.optional(),
  high_24h: nullableNumber.optional(),
  low_24h: nullableNumber.optional(),
  /** Where the price came from: Coinbase when the pair trades there, else CoinGecko. */
  price_source: z.enum(['coinbase', 'coingecko']).optional(),
})
export type CryptoQuote = z.infer<typeof cryptoQuoteSchema>

export const cryptoTopSchema = z.object({
  as_of: z.number().int(),
  coins: z.array(cryptoQuoteSchema),
})
export type CryptoTop = z.infer<typeof cryptoTopSchema>

export const candleSchema = z.object({
  time: z.number().int(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
})
export type Candle = z.infer<typeof candleSchema>

export const historySchema = z.object({
  symbol: z.string(),
  period: z.string(),
  interval: z.string(),
  candles: z.array(candleSchema),
})
export type History = z.infer<typeof historySchema>

const series = z.array(nullableNumber)

export const indicatorKindSchema = z.enum(['overlay', 'pane'])
export type IndicatorKind = z.infer<typeof indicatorKindSchema>

export const indicatorSeriesSchema = z.object({
  id: z.string(),
  kind: indicatorKindSchema,
  params: z.record(z.string(), z.number()),
  outputs: z.record(z.string(), series),
})
export type IndicatorSeries = z.infer<typeof indicatorSeriesSchema>

export const indicatorsSchema = historySchema.extend({
  /** Keyed by canonical request token (`rsi:14`, `bb:20-2`), in request order. */
  series: z.record(z.string(), indicatorSeriesSchema),
  levels: z.array(
    z.object({
      price: z.number(),
      touches: z.number().int(),
      kind: z.enum(['support', 'resistance']),
    }),
  ),
})
export type Indicators = z.infer<typeof indicatorsSchema>

export const indicatorParamSchema = z.object({
  name: z.string(),
  default: z.number(),
  min: z.number(),
  max: z.number(),
  integer: z.boolean(),
})
export const indicatorSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: indicatorKindSchema,
  outputs: z.array(z.string()),
  params: z.array(indicatorParamSchema),
  reference_lines: z.array(z.number()),
  description: z.string(),
  formula: z.string(),
})
export type IndicatorSpec = z.infer<typeof indicatorSpecSchema>
export const indicatorCatalogSchema = z.object({
  indicators: z.array(indicatorSpecSchema),
  defaults: z.array(z.string()),
  max_per_request: z.number().int(),
})
export type IndicatorCatalog = z.infer<typeof indicatorCatalogSchema>
export type Level = Indicators['levels'][number]

export const recommendationsSchema = z.object({
  symbol: z.string(),
  summary: z.array(
    z.object({
      period: z.string(),
      strong_buy: z.number().int(),
      buy: z.number().int(),
      hold: z.number().int(),
      sell: z.number().int(),
      strong_sell: z.number().int(),
    }),
  ),
  price_targets: z.object({
    current: nullableNumber.optional(),
    high: nullableNumber.optional(),
    low: nullableNumber.optional(),
    mean: nullableNumber.optional(),
    median: nullableNumber.optional(),
  }),
  upgrades_downgrades: z.array(
    z.object({
      date: z.string(),
      firm: z.string(),
      to_grade: nullableString.optional(),
      from_grade: nullableString.optional(),
      action: nullableString.optional(),
      price_target_action: nullableString.optional(),
      current_price_target: nullableNumber.optional(),
      prior_price_target: nullableNumber.optional(),
    }),
  ),
})
export type Recommendations = z.infer<typeof recommendationsSchema>

export const PORTFOLIO_REQUEST_PERIODS = ['1y', '2y', '5y'] as const
export type RequestHolding = { symbol: string; weight: number } | { symbol: string; amount: number }
export interface PortfolioRequest {
  holdings: RequestHolding[]
  period: (typeof PORTFOLIO_REQUEST_PERIODS)[number]
}
export interface SimulateRequest extends PortfolioRequest {
  horizon_years: number
  n_sims: number
  initial_value: number
  monthly_contribution: number
  seed?: number
}

export const assetStatsSchema = z.object({
  symbol: z.string(),
  weight: z.number(),
  annual_return: z.number(),
  annual_vol: z.number(),
})
export const portfolioStatsSchema = z.object({
  symbols: z.array(z.string()),
  weights: z.array(z.number()),
  period: z.string(),
  start: z.string(),
  end: z.string(),
  n_obs: z.number().int(),
  annual_return: z.number(),
  annual_vol: z.number(),
  sharpe: z.number(),
  max_drawdown: z.number(),
  assets: z.array(assetStatsSchema),
  correlation: z.array(z.array(z.number())),
})
export type PortfolioStats = z.infer<typeof portfolioStatsSchema>

export const simulationSchema = z.object({
  initial_value: z.number(),
  horizon_years: z.number(),
  steps_per_year: z.number().int(),
  n_sims: z.number().int(),
  times: z.array(z.number()),
  bands: z.record(z.string(), z.array(z.number())),
  terminal: z.record(z.string(), z.number()),
  stats: portfolioStatsSchema,
})
export type Simulation = z.infer<typeof simulationSchema>

export interface RetirementRequest {
  current_age: number
  retirement_age: number
  life_expectancy: number
  current_savings: number
  monthly_contribution: number
  expected_return: number
  inflation: number
  annual_spending: number
  mode: 'parametric' | 'portfolio'
  volatility: number
  holdings?: RequestHolding[]
  period?: (typeof PORTFOLIO_REQUEST_PERIODS)[number]
  n_sims: number
  seed?: number
}

export const yearPointSchema = z.object({
  age: z.number().int(),
  year: z.number().int(),
  balance_nominal: z.number(),
  balance_real: z.number(),
  cashflow: z.number(),
})
export const retirementOutSchema = z.object({
  assumptions: z.object({
    mu: z.number(),
    sigma: z.number(),
    source: z.enum(['parametric', 'portfolio']),
    symbols: z.array(z.string()).default([]),
  }),
  deterministic: z.array(yearPointSchema),
  monte_carlo: z.object({
    success_probability: z.number(),
    ages: z.array(z.number().int()),
    bands: z.record(z.string(), z.array(z.number())),
    median_depletion_age: z.number().int().nullable(),
    terminal: z.record(z.string(), z.number()),
    n_sims: z.number().int(),
  }),
})
export type RetirementOut = z.infer<typeof retirementOutSchema>

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  /** 503: the feature is switched off server-side (or an upstream is throttling us). */
  get isUnavailable(): boolean {
    return this.status === 503
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }
}

async function readDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'detail' in body) {
      const detail = (body as { detail: unknown }).detail
      if (typeof detail === 'string') return detail
      return JSON.stringify(detail)
    }
  } catch {
    // fall through to the status text
  }
  return response.statusText || `Request failed with status ${response.status}`
}

export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  params?: Record<string, string | number | undefined>,
  init?: RequestInit,
): Promise<T> {
  const url = new URL(path, API_URL)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }
  const response = await fetch(url, { ...init, headers: { Accept: 'application/json', ...init?.headers } })
  if (!response.ok) throw new ApiError(response.status, await readDetail(response))
  return schema.parse(await response.json())
}

/** POST a JSON body; errors and parsing behave exactly like `apiFetch`. */
export function postJson<T>(path: string, schema: z.ZodType<T>, body: unknown, init?: RequestInit): Promise<T> {
  return apiFetch(path, schema, undefined, {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    body: JSON.stringify(body),
  })
}

// -- AI news sentiment ---------------------------------------------------------------------

export const SENTIMENTS = ['bullish', 'neutral', 'bearish'] as const
export type Sentiment = (typeof SENTIMENTS)[number]
const sentimentEnum = z.enum(SENTIMENTS)

export const sentimentStatusSchema = z.object({
  enabled: z.boolean(),
  model: nullableString.optional(),
})
export type SentimentStatus = z.infer<typeof sentimentStatusSchema>

export const sentimentReportSchema = z.object({
  overall: sentimentEnum,
  score: z.number(),
  confidence: z.number(),
  themes: z.array(z.string()),
  articles: z.array(z.object({ index: z.number().int(), sentiment: sentimentEnum, rationale: z.string() })),
  summary: z.string(),
})
export type SentimentReport = z.infer<typeof sentimentReportSchema>

export const sentimentArticleSchema = z.object({
  index: z.number().int(),
  title: z.string(),
  provider: nullableString.optional(),
  published_at: nullableString.optional(),
  url: nullableString.optional(),
  sentiment: sentimentEnum.nullable().optional(),
  rationale: nullableString.optional(),
})
export type SentimentArticle = z.infer<typeof sentimentArticleSchema>

export const sentimentOutSchema = z.object({
  symbol: z.string(),
  generated_at: z.number(),
  model: z.string(),
  cached: z.boolean(),
  news_count: z.number().int(),
  report: sentimentReportSchema.nullable(),
  articles: z.array(sentimentArticleSchema),
  disclaimer: z.string(),
})
export type SentimentOut = z.infer<typeof sentimentOutSchema>

export const normaliseSymbol = (symbol: string): string => symbol.trim().toUpperCase()

export const api = {
  search: (q: string, limit = 8, init?: RequestInit) =>
    apiFetch(`/search`, z.array(searchResultSchema), { q, limit }, init),
  quote: (symbol: string, init?: RequestInit) =>
    apiFetch(`/quote/${encodeURIComponent(normaliseSymbol(symbol))}`, quoteSchema, undefined, init),
  quotes: (symbols: string[], init?: RequestInit) =>
    apiFetch(`/quotes`, quoteBatchSchema, { tickers: symbols.map(normaliseSymbol).join(',') }, init),
  history: (symbol: string, period: Period = '1y', interval: Interval = '1d', init?: RequestInit) =>
    apiFetch(`/history/${encodeURIComponent(normaliseSymbol(symbol))}`, historySchema, { period, interval }, init),
  indicators: (symbol: string, period: Period = '1y', interval: Interval = '1d', tokens?: readonly string[], init?: RequestInit) =>
    apiFetch(
      `/indicators/${encodeURIComponent(normaliseSymbol(symbol))}`,
      indicatorsSchema,
      { period, interval, ind: tokens?.length ? tokens.join(',') : undefined },
      init,
    ),
  indicatorCatalog: (init?: RequestInit) => apiFetch(`/indicators/catalog`, indicatorCatalogSchema, undefined, init),
  recommendations: (symbol: string, init?: RequestInit) =>
    apiFetch(`/recommendations/${encodeURIComponent(normaliseSymbol(symbol))}`, recommendationsSchema, undefined, init),
  cryptoTop: (limit = 25, init?: RequestInit) => apiFetch(`/crypto/top`, cryptoTopSchema, { limit }, init),
  portfolioAnalyse: (body: PortfolioRequest, init?: RequestInit) => postJson(`/portfolio/analyse`, portfolioStatsSchema, body, init),
  portfolioSimulate: (body: SimulateRequest, init?: RequestInit) => postJson(`/portfolio/simulate`, simulationSchema, body, init),
  retirementProject: (body: RetirementRequest, init?: RequestInit) => postJson(`/retirement/project`, retirementOutSchema, body, init),
  sentimentStatus: (init?: RequestInit) => apiFetch(`/sentiment/status`, sentimentStatusSchema, undefined, init),
  sentiment: (symbol: string, init?: RequestInit) =>
    apiFetch(`/sentiment/${encodeURIComponent(normaliseSymbol(symbol))}`, sentimentOutSchema, undefined, init),
}
