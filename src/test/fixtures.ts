import type { CryptoTop, Indicators, PortfolioStats, Quote, Recommendations, RetirementOut, RetirementRequest, SearchResult, Simulation } from '@/lib/api'
import { projectDeterministic } from '@/lib/retirement'

export const searchFixtures: Record<string, SearchResult[]> = {
  apple: [
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'EQUITY' },
    { symbol: 'APC.DE', name: 'Apple Inc.', exchange: 'XETRA', type: 'EQUITY' },
  ],
  msft: [{ symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'EQUITY' }],
  bitcoin: [
    { symbol: 'BTC-USD', name: 'Bitcoin USD', exchange: 'CCC', type: 'CRYPTOCURRENCY' },
    { symbol: 'IBIT', name: 'iShares Bitcoin Trust ETF', exchange: 'NASDAQ', type: 'ETF' },
  ],
}

export const quoteFixtures: Record<string, Quote> = {
  AAPL: {
    symbol: 'AAPL',
    price: 200,
    previous_close: 190,
    change: 10,
    change_pct: 5.263,
    volume: 1_234_567,
    market_cap: 3e12,
    currency: 'USD',
    exchange: 'NMS',
    day_high: 202.5,
    day_low: 197,
    year_high: 260,
    year_low: 150,
    quote_type: 'EQUITY',
  },
  MSFT: {
    symbol: 'MSFT',
    price: 400,
    previous_close: 404,
    change: -4,
    change_pct: -0.99,
    volume: 2_000_000,
    market_cap: 3.2e12,
    currency: 'USD',
    exchange: 'NMS',
    day_high: null,
    day_low: null,
    year_high: null,
    year_low: null,
  },
  'BTC-USD': {
    symbol: 'BTC-USD',
    price: 65000,
    previous_close: 64000,
    change: 1000,
    change_pct: 1.5625,
    volume: 30_000_000_000,
    market_cap: 1.3e12,
    currency: 'USD',
    exchange: 'CCC',
    day_high: 66000,
    day_low: 63500,
    year_high: 126000,
    year_low: 57000,
    quote_type: 'CRYPTOCURRENCY',
  },
  'ETH-USD': {
    symbol: 'ETH-USD',
    price: 3200,
    previous_close: 3224,
    change: -24,
    change_pct: -0.75,
    volume: 12_000_000_000,
    market_cap: 3.9e11,
    currency: 'USD',
    exchange: 'CCC',
    quote_type: 'CRYPTOCURRENCY',
  },
}

export const cryptoTopFixture: CryptoTop = {
  as_of: 1_789_137_683,
  coins: [
    { symbol: 'BTC-USD', name: 'Bitcoin USD', price: 65000, change_pct: 1.5, market_cap: 1.3e12, volume: 31e9, circulating_supply: 20_000_000, rank: 1, icon: 'https://img.example/btc.png', high_24h: 66000, low_24h: 63500, price_source: 'coinbase' },
    { symbol: 'ETH-USD', name: 'Ethereum USD', price: 3200, change_pct: -0.75, market_cap: 3.9e11, volume: 12e9, circulating_supply: 120_000_000, rank: 2, icon: null, price_source: 'coinbase' },
    { symbol: 'DOGE-USD', name: 'Dogecoin USD', price: 0.1234, change_pct: null, market_cap: 1.8e10, volume: null, circulating_supply: null, rank: 4, price_source: 'coingecko' },
  ],
}

const DAY = 86_400
export function makeCandles(n = 30, start = 1_767_312_000): Indicators['candles'] {
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + Math.sin(i / 3) * 5
    return { time: start + i * DAY, open: close - 0.5, high: close + 1, low: close - 1, close, volume: 1_000_000 + i }
  })
}

export function makeIndicators(symbol = 'AAPL', n = 30): Indicators {
  const candles = makeCandles(n)
  const closes = candles.map((c) => c.close)
  const series = (offset: number) => closes.map((c, i) => (i < 19 ? null : c + offset))
  return {
    symbol,
    period: '1y',
    interval: '1d',
    candles,
    ema: { '10': closes, '30': closes, '60': closes, '90': closes },
    bollinger: { window: 20, k: 2, middle: series(0), upper: series(2), lower: series(-2) },
    levels: [
      { price: 105, touches: 4, kind: 'resistance' },
      { price: 95, touches: 3, kind: 'support' },
    ],
  }
}

export const recommendationsFixture: Recommendations = {
  symbol: 'AAPL',
  summary: [
    { period: '0m', strong_buy: 6, buy: 18, hold: 13, sell: 3, strong_sell: 3 },
    { period: '-1m', strong_buy: 6, buy: 19, hold: 14, sell: 3, strong_sell: 2 },
  ],
  price_targets: { current: 200, high: 260, low: 150, mean: 225.5, median: 230 },
  upgrades_downgrades: [
    {
      date: '2026-09-02T17:34:35',
      firm: 'Morgan Stanley',
      to_grade: 'Overweight',
      from_grade: 'Overweight',
      action: 'main',
      price_target_action: 'Raises',
      current_price_target: 370,
      prior_price_target: 360,
    },
  ],
}

/** Deterministic analytics for any symbol set: return grows with the index, vol with 2x. */
export function makePortfolioStats(symbols: string[], weights: number[], period = '2y'): PortfolioStats {
  const assets = symbols.map((symbol, i) => ({ symbol, weight: weights[i]!, annual_return: 0.08 + i * 0.02, annual_vol: 0.2 + i * 0.05 }))
  const annual_return = assets.reduce((s, a) => s + a.weight * a.annual_return, 0)
  const annual_vol = assets.reduce((s, a) => s + a.weight * a.annual_vol, 0) * 0.8
  return {
    symbols,
    weights,
    period,
    start: '2024-09-11',
    end: '2026-09-10',
    n_obs: 500,
    annual_return,
    annual_vol,
    sharpe: annual_vol > 0 ? annual_return / annual_vol : 0,
    max_drawdown: -0.25,
    assets,
    correlation: symbols.map((_, i) => symbols.map((__, j) => (i === j ? 1 : 0.3))),
  }
}

export function makeSimulation(stats: PortfolioStats, req: { horizon_years: number; n_sims: number; initial_value: number; monthly_contribution: number }): Simulation {
  const points = 11
  const times = Array.from({ length: points }, (_, i) => (i / (points - 1)) * req.horizon_years)
  const band = (k: number) => times.map((t) => req.initial_value * Math.exp((stats.annual_return + k * stats.annual_vol) * t) + req.monthly_contribution * 12 * t)
  const bands = { p5: band(-1.5), p25: band(-0.6), p50: band(0), p75: band(0.6), p95: band(1.5) }
  const baseline = req.initial_value + req.monthly_contribution * 12 * req.horizon_years
  const p5 = bands.p5.at(-1)!
  return {
    initial_value: req.initial_value,
    horizon_years: req.horizon_years,
    steps_per_year: req.horizon_years <= 2 ? 252 : req.horizon_years <= 10 ? 52 : 12,
    n_sims: req.n_sims,
    times,
    bands,
    terminal: {
      mean: bands.p50.at(-1)! * 1.05,
      median: bands.p50.at(-1)!,
      p5,
      p25: bands.p25.at(-1)!,
      p75: bands.p75.at(-1)!,
      p95: bands.p95.at(-1)!,
      prob_loss: 0.12,
      var_95: Math.max(0, baseline - p5),
      var_95_pct: Math.max(0, baseline - p5) / baseline,
      cvar_95: Math.max(0, baseline - p5) * 1.2,
    },
    stats,
  }
}

/** Deterministic path from the TS twin plus synthetic bands: p50 = real path, spread by sigma. */
export function makeRetirement(req: RetirementRequest, assumptions?: Partial<RetirementOut['assumptions']>): RetirementOut {
  const a = { mu: req.expected_return, sigma: req.volatility, source: 'parametric' as const, symbols: [] as string[], ...assumptions }
  const points = projectDeterministic({ ...req, volatility: req.volatility, expected_return: a.mu })
  const real = points.map((p) => p.balance_real)
  const band = (k: number) => real.map((v, i) => Math.max(0, v * (1 + k * a.sigma * Math.sqrt(i))))
  const bands = { p5: band(-1.6), p25: band(-0.7), p50: real, p75: band(0.7), p95: band(1.6) }
  const last = real.at(-1) ?? 0
  return {
    assumptions: a,
    deterministic: points,
    monte_carlo: {
      success_probability: last > 0 ? 0.82 : 0.1,
      ages: points.map((p) => p.age),
      bands,
      median_depletion_age: last > 0 ? null : req.retirement_age + 12,
      terminal: { mean: last, median: last, p5: bands.p5.at(-1)!, p25: bands.p25.at(-1)!, p75: bands.p75.at(-1)!, p95: bands.p95.at(-1)!, prob_loss: 0.2, var_95: 0, var_95_pct: 0, cvar_95: 0 },
      n_sims: req.n_sims,
    },
  }
}
