import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { normaliseSymbol, type Interval, type Period } from './api'
import { fromLegacy, tokenListSchema } from './indicators'
import { MAX_COMPARE } from './viz-palette'

export const CHART_PERIODS = ['1mo', '3mo', '6mo', '1y', '2y', '5y'] as const satisfies readonly Period[]
export const CHART_INTERVALS = ['1d', '1wk'] as const satisfies readonly Interval[]
export type ChartPeriod = (typeof CHART_PERIODS)[number]
export type ChartInterval = (typeof CHART_INTERVALS)[number]

export const PERIOD_LABELS: Record<ChartPeriod, string> = {
  '1mo': '1M',
  '3mo': '3M',
  '6mo': '6M',
  '1y': '1Y',
  '2y': '2Y',
  '5y': '5Y',
}
export const INTERVAL_LABELS: Record<ChartInterval, string> = { '1d': 'Daily', '1wk': 'Weekly' }

export const DEFAULT_PERIOD: ChartPeriod = '1y'
export const DEFAULT_INTERVAL: ChartInterval = '1d'
const PARAM = { period: 'period', interval: 'interval', overlays: 'ov', indicators: 'ind', compare: 'cmp' } as const

export interface ChartParams {
  period: ChartPeriod
  interval: ChartInterval
  /** Extra symbols overlaid as normalised % change; non-empty means compare mode is on. */
  compare: string[]
}

export function parseCompare(raw: string | null): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const part of raw.split(',')) {
    const symbol = normaliseSymbol(part)
    if (symbol && !out.includes(symbol)) out.push(symbol)
  }
  return out.slice(0, MAX_COMPARE - 1)
}

/**
 * Indicators shared through a link: `ind=rsi:14,macd` (or the pre-Phase-12 `ov=ema10,bb`).
 * Read once by the Charts tab, applied to the saved selection, then removed from the URL.
 */
export function parseSharedIndicators(params: URLSearchParams): string[] | null {
  const ind = params.get(PARAM.indicators)
  if (ind !== null) {
    const parsed = tokenListSchema.safeParse(ind.split(',').filter(Boolean))
    return parsed.success ? parsed.data : null
  }
  const legacy = params.get(PARAM.overlays)
  if (legacy !== null) return legacy === 'none' ? [] : fromLegacy(legacy.split(','))
  return null
}

function pick<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback
}

/** Chart period / interval / overlay toggles, all persisted in URL search params. */
export function useChartParams(): ChartParams & {
  setPeriod: (period: ChartPeriod) => void
  setInterval: (interval: ChartInterval) => void
  /** Tokens from a shared link, or null; `clearSharedIndicators` removes them once applied. */
  sharedIndicators: string[] | null
  clearSharedIndicators: () => void
  setCompare: (symbols: string[]) => void
  toggleCompare: (symbol: string) => void
} {
  const [params, setParams] = useSearchParams()
  const period = pick(params.get(PARAM.period), CHART_PERIODS, DEFAULT_PERIOD)
  const interval = pick(params.get(PARAM.interval), CHART_INTERVALS, DEFAULT_INTERVAL)
  const sharedRaw = `${params.get(PARAM.indicators) ?? ''}|${params.get(PARAM.overlays) ?? ''}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sharedIndicators = useMemo(() => parseSharedIndicators(params), [sharedRaw])
  const compareRaw = params.get(PARAM.compare)
  const compare = useMemo(() => parseCompare(compareRaw), [compareRaw])

  const update = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value === null) next.delete(key)
          else next.set(key, value)
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setPeriod = useCallback((p: ChartPeriod) => update(PARAM.period, p === DEFAULT_PERIOD ? null : p), [update])
  const setInterval = useCallback(
    (i: ChartInterval) => update(PARAM.interval, i === DEFAULT_INTERVAL ? null : i),
    [update],
  )
  const clearSharedIndicators = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(PARAM.indicators)
        next.delete(PARAM.overlays)
        return next
      },
      { replace: true },
    )
  }, [setParams])

  const setCompare = useCallback(
    (symbols: string[]) => {
      const clean = parseCompare(symbols.join(','))
      update(PARAM.compare, clean.length ? clean.join(',') : null)
    },
    [update],
  )
  const toggleCompare = useCallback(
    (symbol: string) => {
      const clean = normaliseSymbol(symbol)
      setCompare(compare.includes(clean) ? compare.filter((s) => s !== clean) : [...compare, clean])
    },
    [compare, setCompare],
  )

  return { period, interval, compare, sharedIndicators, clearSharedIndicators, setPeriod, setInterval, setCompare, toggleCompare }
}
