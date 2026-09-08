import { formatPct, normaliseSeries } from './compare'

const DAY = 86_400
const t0 = 1_767_312_000
const candle = (time: number, close: number) => ({ time, open: close, high: close, low: close, close, volume: 1 })

describe('normaliseSeries', () => {
  it('rebases each series to 0% at the first shared bar', () => {
    const out = normaliseSeries(
      {
        AAPL: [candle(t0, 100), candle(t0 + DAY, 110), candle(t0 + 2 * DAY, 121)],
        MSFT: [candle(t0 + DAY, 50), candle(t0 + 2 * DAY, 45)],
      },
      '1d',
    )
    const aapl = out.find((s) => s.symbol === 'AAPL')!
    const msft = out.find((s) => s.symbol === 'MSFT')!
    // AAPL's first bar is dropped because MSFT starts a day later.
    expect(aapl.points.map((p) => +p.value.toFixed(2))).toEqual([0, 10])
    expect(msft.points.map((p) => +p.value.toFixed(2))).toEqual([0, -10])
    expect(aapl.last).toBeCloseTo(10)
    expect(typeof aapl.points[0]!.time).toBe('string')
  })

  it('skips empty or missing series and returns [] when nothing is usable', () => {
    expect(normaliseSeries({ A: [], B: undefined }, '1d')).toEqual([])
    const out = normaliseSeries({ A: [candle(t0, 10)], B: [] }, '1d')
    expect(out.map((s) => s.symbol)).toEqual(['A'])
    expect(out[0]!.points).toEqual([{ time: expect.any(String), value: 0 }])
  })

  it('handles a series with no bars inside the shared window', () => {
    const out = normaliseSeries({ A: [candle(t0, 10), candle(t0 + DAY, 12)], B: [candle(t0 + 5 * DAY, 3)] }, '1d')
    expect(out.find((s) => s.symbol === 'A')!.points).toEqual([])
    expect(out.find((s) => s.symbol === 'A')!.last).toBeNull()
  })

  it('keeps intraday timestamps numeric', () => {
    const out = normaliseSeries({ A: [candle(t0, 10), candle(t0 + 3600, 11)] }, '1h')
    expect(typeof out[0]!.points[0]!.time).toBe('number')
  })
})

describe('formatPct', () => {
  it('signs and rounds', () => {
    expect(formatPct(12.345)).toBe('+12.35%')
    expect(formatPct(-3, 1)).toBe('-3.0%')
    expect(formatPct(0)).toBe('0.00%')
    expect(formatPct(null)).toBe('—')
    expect(formatPct(Number.NaN)).toBe('—')
  })
})
