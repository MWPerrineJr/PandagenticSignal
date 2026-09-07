import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Interval, Period } from './api'
import { OVERLAY_IDS, isOverlayId, type OverlayId } from './chart-data'

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
export const DEFAULT_OVERLAYS: readonly OverlayId[] = OVERLAY_IDS

const PARAM = { period: 'period', interval: 'interval', overlays: 'ov' } as const
const NONE = 'none'

export interface ChartParams {
  period: ChartPeriod
  interval: ChartInterval
  overlays: Set<OverlayId>
}

export function parseOverlays(raw: string | null): Set<OverlayId> {
  if (raw === null) return new Set(DEFAULT_OVERLAYS)
  if (raw === NONE || raw === '') return new Set()
  return new Set(raw.split(',').filter(isOverlayId))
}

export function serialiseOverlays(overlays: Set<OverlayId>): string | null {
  const list = OVERLAY_IDS.filter((id) => overlays.has(id))
  if (list.length === OVERLAY_IDS.length) return null // default → keep the URL clean
  return list.length === 0 ? NONE : list.join(',')
}

function pick<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback
}

/** Chart period / interval / overlay toggles, all persisted in URL search params. */
export function useChartParams(): ChartParams & {
  setPeriod: (period: ChartPeriod) => void
  setInterval: (interval: ChartInterval) => void
  toggleOverlay: (id: OverlayId) => void
} {
  const [params, setParams] = useSearchParams()
  const period = pick(params.get(PARAM.period), CHART_PERIODS, DEFAULT_PERIOD)
  const interval = pick(params.get(PARAM.interval), CHART_INTERVALS, DEFAULT_INTERVAL)
  const overlaysRaw = params.get(PARAM.overlays)
  const overlays = useMemo(() => parseOverlays(overlaysRaw), [overlaysRaw])

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
  const toggleOverlay = useCallback(
    (id: OverlayId) => {
      const next = new Set(overlays)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      update(PARAM.overlays, serialiseOverlays(next))
    },
    [overlays, update],
  )

  return { period, interval, overlays, setPeriod, setInterval, toggleOverlay }
}
