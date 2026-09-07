/**
 * Pure mapping from `/indicators` rows into lightweight-charts series shapes.
 * No chart-library imports here so it stays trivially testable.
 */
import type { BusinessDay, Time, UTCTimestamp } from 'lightweight-charts'
import type { Candle, Indicators, Interval, Level } from './api'

/** Unix seconds for intraday bars, `yyyy-mm-dd` for daily and coarser. */
export type ChartTime = Time

export interface OhlcPoint {
  time: ChartTime
  open: number
  high: number
  low: number
  close: number
}
export interface VolumePoint {
  time: ChartTime
  value: number
  color: string
}
export interface LinePoint {
  time: ChartTime
  value: number
}

export const INTRADAY_INTERVALS: ReadonlySet<Interval> = new Set(['1m', '5m', '15m', '30m', '1h'])

export function isIntraday(interval: Interval | string): boolean {
  return INTRADAY_INTERVALS.has(interval as Interval)
}

const HALF_DAY = 12 * 3600

/**
 * Daily (and coarser) bars arrive stamped at exchange-local midnight expressed as UTC, so the
 * UTC calendar date can be off by one for exchanges east of Greenwich. Shifting by 12 h before
 * taking the date lands on the trading day for any offset in (-12 h, +12 h]. Intraday bars keep
 * their exact Unix timestamp so lightweight-charts can show clock times.
 */
export function toChartTime(unixSeconds: number, interval: Interval | string): ChartTime {
  if (isIntraday(interval)) return unixSeconds as UTCTimestamp
  return new Date((unixSeconds + HALF_DAY) * 1000).toISOString().slice(0, 10)
}

export function toCandles(candles: Candle[], interval: Interval | string): OhlcPoint[] {
  return candles.map((c) => ({
    time: toChartTime(c.time, interval),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }))
}

export function toVolume(
  candles: Candle[],
  interval: Interval | string,
  colors: { up: string; down: string },
): VolumePoint[] {
  return candles.map((c) => ({
    time: toChartTime(c.time, interval),
    value: c.volume,
    color: c.close >= c.open ? colors.up : colors.down,
  }))
}

/** Pairs an aligned indicator series with candle times, dropping warm-up nulls. */
export function toLine(candles: Candle[], values: Array<number | null>, interval: Interval | string): LinePoint[] {
  const out: LinePoint[] = []
  const n = Math.min(candles.length, values.length)
  for (let i = 0; i < n; i++) {
    const v = values[i]
    if (v == null || !Number.isFinite(v)) continue
    out.push({ time: toChartTime(candles[i]!.time, interval), value: v })
  }
  return out
}

export const EMA_SPANS = ['10', '30', '60', '90'] as const
export type EmaSpan = (typeof EMA_SPANS)[number]

export const OVERLAY_IDS = ['ema10', 'ema30', 'ema60', 'ema90', 'bb', 'sr'] as const
export type OverlayId = (typeof OVERLAY_IDS)[number]

export const OVERLAY_LABELS: Record<OverlayId, string> = {
  ema10: 'EMA 10',
  ema30: 'EMA 30',
  ema60: 'EMA 60',
  ema90: 'EMA 90',
  bb: 'Bollinger',
  sr: 'S/R',
}

export function isOverlayId(value: string): value is OverlayId {
  return (OVERLAY_IDS as readonly string[]).includes(value)
}

export function emaSpanOf(id: OverlayId): EmaSpan | null {
  return id.startsWith('ema') ? (id.slice(3) as EmaSpan) : null
}

export interface LevelLine {
  price: number
  title: string
  kind: Level['kind']
}

export function toLevelLines(levels: Level[]): LevelLine[] {
  return levels.map((lv) => ({
    price: lv.price,
    kind: lv.kind,
    title: `${lv.kind === 'support' ? 'S' : 'R'} ×${lv.touches}`,
  }))
}

/** Latest non-null value of an aligned series, for the legend when nothing is hovered. */
export function lastValue(values: Array<number | null> | undefined): number | null {
  if (!values) return null
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i]
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

/** Index of the candle whose chart time matches `time`, or -1. */
export function indexAtTime(data: Indicators, interval: Interval | string, time: Time | undefined): number {
  if (time === undefined) return -1
  const wanted: Time = typeof time === 'object' ? businessDayToString(time) : time
  return data.candles.findIndex((c) => toChartTime(c.time, interval) === wanted)
}

export function businessDayToString(bd: BusinessDay): string {
  const mm = String(bd.month).padStart(2, '0')
  const dd = String(bd.day).padStart(2, '0')
  return `${bd.year}-${mm}-${dd}`
}
