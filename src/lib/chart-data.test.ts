import { makeIndicators } from '@/test/fixtures'
import {
  emaSpanOf,
  indexAtTime,
  isIntraday,
  isOverlayId,
  lastValue,
  toCandles,
  toChartTime,
  toLevelLines,
  toLine,
  toVolume,
} from './chart-data'

// 2026-01-02 00:00 in New York = 05:00 UTC; in Tokyo = 2026-01-01 15:00 UTC.
const NY_MIDNIGHT = Date.UTC(2026, 0, 2, 5) / 1000
const TOKYO_MIDNIGHT = Date.UTC(2026, 0, 1, 15) / 1000

describe('toChartTime', () => {
  it('maps daily bars to the exchange-local calendar day', () => {
    expect(toChartTime(NY_MIDNIGHT, '1d')).toBe('2026-01-02')
    expect(toChartTime(TOKYO_MIDNIGHT, '1d')).toBe('2026-01-02')
    expect(toChartTime(NY_MIDNIGHT, '1wk')).toBe('2026-01-02')
  })

  it('keeps exact timestamps for intraday bars', () => {
    expect(toChartTime(NY_MIDNIGHT + 3600, '1h')).toBe(NY_MIDNIGHT + 3600)
    expect(isIntraday('5m')).toBe(true)
    expect(isIntraday('1d')).toBe(false)
  })
})

describe('series mapping', () => {
  const data = makeIndicators('AAPL', 5)

  it('toCandles keeps OHLC and converts time', () => {
    const out = toCandles(data.candles, '1d')
    expect(out).toHaveLength(5)
    expect(out[0]).toMatchObject({ open: data.candles[0]!.open, close: data.candles[0]!.close })
    expect(typeof out[0]!.time).toBe('string')
  })

  it('toVolume colours up and down bars', () => {
    const candles = [
      { time: NY_MIDNIGHT, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      { time: NY_MIDNIGHT + 86400, open: 2, high: 2, low: 0.5, close: 1, volume: 20 },
    ]
    const out = toVolume(candles, '1d', { up: 'green', down: 'red' })
    expect(out.map((v) => v.color)).toEqual(['green', 'red'])
    expect(out.map((v) => v.value)).toEqual([10, 20])
  })

  it('toLine drops warm-up nulls and keeps alignment', () => {
    const values = [null, null, 3, NaN, 5]
    const out = toLine(data.candles, values, '1d')
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ time: toChartTime(data.candles[2]!.time, '1d'), value: 3 })
    expect(out[1]!.value).toBe(5)
  })

  it('toLine tolerates length mismatch', () => {
    expect(toLine(data.candles, [1], '1d')).toHaveLength(1)
    expect(toLine([], [1, 2], '1d')).toHaveLength(0)
  })

  it('toLevelLines labels touches and kind', () => {
    const lines = toLevelLines([
      { price: 105, touches: 4, kind: 'resistance' },
      { price: 95, touches: 3, kind: 'support' },
    ])
    expect(lines.map((l) => l.title)).toEqual(['R ×4', 'S ×3'])
  })

  it('lastValue skips trailing nulls', () => {
    expect(lastValue([1, 2, null, NaN])).toBe(2)
    expect(lastValue([null])).toBeNull()
    expect(lastValue(undefined)).toBeNull()
  })

  it('indexAtTime handles strings, business-day objects and misses', () => {
    const t0 = toChartTime(data.candles[1]!.time, '1d') as string
    const [y, m, d] = t0.split('-').map(Number) as [number, number, number]
    expect(indexAtTime(data, '1d', t0)).toBe(1)
    expect(indexAtTime(data, '1d', { year: y, month: m, day: d })).toBe(1)
    expect(indexAtTime(data, '1d', '1999-01-01')).toBe(-1)
    expect(indexAtTime(data, '1d', undefined)).toBe(-1)
  })

  it('overlay id helpers', () => {
    expect(isOverlayId('ema10')).toBe(true)
    expect(isOverlayId('rsi')).toBe(false)
    expect(emaSpanOf('ema60')).toBe('60')
    expect(emaSpanOf('bb')).toBeNull()
  })
})
