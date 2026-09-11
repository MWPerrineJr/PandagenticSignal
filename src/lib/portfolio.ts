/**
 * Portfolio model shared by the page, the widget, local storage and Supabase. Pure data + zod.
 *
 * Holdings carry one `value` each; the portfolio's `mode` says whether values are relative
 * weights or currency amounts. The API takes `{symbol, weight}` or `{symbol, amount}` rows,
 * which is also how the `portfolios.holdings` column stores them.
 */
import { z } from 'zod'
import { normaliseSymbol, type RequestHolding } from './api'
import { newId } from './dashboard-layout'

export const MAX_HOLDINGS = 20
export const PORTFOLIO_PERIODS = ['1y', '2y', '5y'] as const
export type PortfolioPeriod = (typeof PORTFOLIO_PERIODS)[number]
export const PERIOD_LABELS: Record<PortfolioPeriod, string> = { '1y': '1 year', '2y': '2 years', '5y': '5 years' }

export const holdingModeSchema = z.enum(['weight', 'amount'])
export type HoldingMode = z.infer<typeof holdingModeSchema>

export const holdingSchema = z.object({
  symbol: z.string().min(1).max(16),
  value: z.number().positive().finite(),
})
export type Holding = z.infer<typeof holdingSchema>

export const portfolioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  mode: holdingModeSchema.default('weight'),
  holdings: z.array(holdingSchema).max(MAX_HOLDINGS).default([]),
  updatedAt: z.string(),
})
export type Portfolio = z.infer<typeof portfolioSchema>

/** Upper-case symbols, drop blanks/duplicates/non-positive values, cap the count. */
export function normaliseHoldings(holdings: ReadonlyArray<{ symbol: string; value: number }>): Holding[] {
  const seen = new Set<string>()
  const out: Holding[] = []
  for (const h of holdings) {
    const symbol = normaliseSymbol(h.symbol)
    if (!symbol || seen.has(symbol) || !Number.isFinite(h.value) || h.value <= 0) continue
    seen.add(symbol)
    out.push({ symbol, value: h.value })
    if (out.length >= MAX_HOLDINGS) break
  }
  return out
}

/** Fractions summing to 1, in holding order (empty for no holdings). */
export function weightsFromHoldings(holdings: ReadonlyArray<Holding>): number[] {
  const total = holdings.reduce((s, h) => s + h.value, 0)
  return total > 0 ? holdings.map((h) => h.value / total) : []
}

/** Stable identity of a holdings set for query keys; order-insensitive. */
export function holdingsKey(holdings: ReadonlyArray<Holding>, mode: HoldingMode): string {
  return `${mode}:${[...holdings].sort((a, b) => a.symbol.localeCompare(b.symbol)).map((h) => `${h.symbol}=${h.value}`).join(',')}`
}

export function toRequestHoldings(holdings: ReadonlyArray<Holding>, mode: HoldingMode): RequestHolding[] {
  return holdings.map((h) => (mode === 'weight' ? { symbol: h.symbol, weight: h.value } : { symbol: h.symbol, amount: h.value }))
}

/** Storage shape (`portfolios.holdings` jsonb): the API request rows. */
export function serialiseHoldings(portfolio: Pick<Portfolio, 'holdings' | 'mode'>): RequestHolding[] {
  return toRequestHoldings(portfolio.holdings, portfolio.mode)
}

const storedHoldingSchema = z.object({
  symbol: z.string(),
  weight: z.number().positive().optional(),
  amount: z.number().positive().optional(),
})

/** Parse stored rows back into `{mode, holdings}`; the first row decides the mode. */
export function parseStoredHoldings(raw: unknown): Pick<Portfolio, 'holdings' | 'mode'> {
  const rows = z.array(storedHoldingSchema).max(MAX_HOLDINGS).parse(raw ?? [])
  const mode: HoldingMode = rows[0]?.amount != null && rows[0]?.weight == null ? 'amount' : 'weight'
  const holdings = normaliseHoldings(
    rows.flatMap((r) => {
      const value = mode === 'weight' ? r.weight : r.amount
      return value == null ? [] : [{ symbol: r.symbol, value }]
    }),
  )
  return { mode, holdings }
}

export function parsePortfolio(raw: unknown): Portfolio {
  const p = portfolioSchema.parse(raw)
  return { ...p, holdings: normaliseHoldings(p.holdings) }
}

export function makePortfolio(name: string, holdings: Holding[] = [], mode: HoldingMode = 'weight'): Portfolio {
  return { id: newId(), name, mode, holdings: normaliseHoldings(holdings), updatedAt: new Date().toISOString() }
}

export function starterPortfolio(): Portfolio {
  return makePortfolio('My portfolio')
}

export function holdingsEqual(a: Pick<Portfolio, 'holdings' | 'mode'>, b: Pick<Portfolio, 'holdings' | 'mode'>): boolean {
  return a.mode === b.mode && holdingsKey(a.holdings, a.mode) === holdingsKey(b.holdings, b.mode) && a.holdings.length === b.holdings.length
}
