import type { Recommendations } from './api'

export type Grade = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
export const GRADES: readonly Grade[] = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell']
export const GRADE_LABELS: Record<Grade, string> = {
  strong_buy: 'Strong buy',
  buy: 'Buy',
  hold: 'Hold',
  sell: 'Sell',
  strong_sell: 'Strong sell',
}

export type Summary = Recommendations['summary'][number]

export function totalAnalysts(p: Summary): number {
  return p.strong_buy + p.buy + p.hold + p.sell + p.strong_sell
}

export interface Consensus {
  label: string
  /** 1 (strong sell) → 5 (strong buy) weighted mean. */
  score: number
  analysts: number
}

/** Weighted mean of the latest period: strong buy 5 … strong sell 1, bucketed to a label. */
export function consensus(p: Summary | undefined): Consensus | null {
  if (!p) return null
  const n = totalAnalysts(p)
  if (n === 0) return null
  const score = (5 * p.strong_buy + 4 * p.buy + 3 * p.hold + 2 * p.sell + 1 * p.strong_sell) / n
  const label =
    score >= 4.5 ? 'Strong buy' : score >= 3.5 ? 'Buy' : score >= 2.5 ? 'Hold' : score >= 1.5 ? 'Sell' : 'Strong sell'
  return { label, score, analysts: n }
}

/** yfinance periods are "0m", "-1m", "-2m"… relative months. */
export function periodLabel(period: string): string {
  const m = /^-?(\d+)m$/.exec(period)
  if (!m) return period
  const n = Number(m[1])
  if (n === 0) return 'This month'
  return n === 1 ? '1 month ago' : `${n} months ago`
}

export function hasCoverage(rec: Recommendations): boolean {
  const targets = rec.price_targets
  const anyTarget = [targets.high, targets.low, targets.mean, targets.median].some((v) => v != null)
  return rec.summary.some((p) => totalAnalysts(p) > 0) || anyTarget || rec.upgrades_downgrades.length > 0
}

/** % distance from the current price to a target; null when either side is missing. */
export function upside(current: number | null | undefined, target: number | null | undefined): number | null {
  if (current == null || target == null || current === 0) return null
  return (target / current - 1) * 100
}

/** Position of `value` on the low→high track as a 0–1 fraction (clamped), for the gauge. */
export function trackPosition(value: number | null | undefined, low: number, high: number): number | null {
  if (value == null || !Number.isFinite(value) || high <= low) return null
  return Math.min(1, Math.max(0, (value - low) / (high - low)))
}

export type GradeDirection = 'up' | 'down' | 'same' | 'new'

/** Classify a rating change from yfinance's `Action` column (up, down, main, init, reit). */
export function gradeDirection(action: string | null | undefined): GradeDirection {
  switch ((action ?? '').toLowerCase()) {
    case 'up':
      return 'up'
    case 'down':
      return 'down'
    case 'init':
      return 'new'
    default:
      return 'same'
  }
}
