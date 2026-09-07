import type { Indicators, Quote, Recommendations, SearchResult } from '@/lib/api'

export const searchFixtures: Record<string, SearchResult[]> = {
  apple: [
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'EQUITY' },
    { symbol: 'APC.DE', name: 'Apple Inc.', exchange: 'XETRA', type: 'EQUITY' },
  ],
  msft: [{ symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'EQUITY' }],
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
