import type { CryptoTop, Indicators, Quote, Recommendations, SearchResult } from '@/lib/api'

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
