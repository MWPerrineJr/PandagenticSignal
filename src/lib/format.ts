const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

/** Currency with 2 decimals; sub-dollar prices (small-cap coins) keep 4–6 so they do not read as $0.00. */
export function formatPrice(value: number | null | undefined, currency = 'USD'): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const small = value !== 0 && Math.abs(value) < 1
  const digits = small ? { minimumFractionDigits: 4, maximumFractionDigits: 6 } : { maximumFractionDigits: 2 }
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, ...digits }).format(value)
  } catch {
    return value.toFixed(small ? 4 : 2)
  }
}

/** Signed percentage, e.g. "+1.65%". */
export function formatPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—'
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`
}

export function formatChange(change: number | null | undefined, pct: number | null | undefined): string {
  if (change == null || pct == null) return '—'
  const sign = change > 0 ? '+' : ''
  return `${sign}${change.toFixed(2)} (${sign}${pct.toFixed(2)}%)`
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return compact.format(value)
}
