/** Normalisation maths for compare mode: every series rebased to % change from a shared start. */
import type { Candle } from './api'
import { toChartTime, type LinePoint } from './chart-data'

export interface NormalisedSeries {
  symbol: string
  points: LinePoint[]
  /** Latest % change, or null when the series had no bars in the shared window. */
  last: number | null
}

/**
 * Rebase each symbol's closes to 0% at the first bar that every series has, so lines start
 * together and a later-listed ticker cannot appear to "lead" only because it has fewer bars.
 */
export function normaliseSeries(
  input: Record<string, Candle[] | undefined>,
  interval: string,
): NormalisedSeries[] {
  const entries = Object.entries(input).filter((e): e is [string, Candle[]] => !!e[1] && e[1].length > 0)
  if (entries.length === 0) return []
  const start = Math.max(...entries.map(([, candles]) => candles[0]!.time))
  return entries.map(([symbol, candles]) => {
    const window = candles.filter((c) => c.time >= start)
    const base = window[0]?.close
    if (!base) return { symbol, points: [], last: null }
    const points = window.map((c) => ({ time: toChartTime(c.time, interval), value: (c.close / base - 1) * 100 }))
    return { symbol, points, last: points.at(-1)?.value ?? null }
  })
}

export function formatPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}
