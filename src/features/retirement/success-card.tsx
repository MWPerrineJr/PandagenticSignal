import type { RetirementOut } from '@/lib/api'
import { formatPercent, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

export function SuccessCard({ out }: { out: RetirementOut }) {
  const mc = out.monte_carlo
  const p = mc.success_probability
  const tone = p >= 0.8 ? 'text-emerald-500' : p >= 0.6 ? 'text-amber-500' : 'text-red-500'
  const verdict = p >= 0.8 ? 'Comfortable' : p >= 0.6 ? 'Borderline' : 'At risk'
  return (
    <div className="grid gap-3 sm:grid-cols-3" data-testid="success-card">
      <div className="rounded-lg border bg-card p-4 sm:col-span-1">
        <p className="text-xs text-muted-foreground">Chance your money lasts to {mc.ages.at(-1)}</p>
        <p className={cn('text-4xl font-semibold tabular-nums', tone)} data-testid="success-probability">
          {formatPercent(p, 0)}
        </p>
        <p className="text-sm text-muted-foreground">{verdict}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 text-sm sm:col-span-2">
        <div>
          <dt className="text-xs text-muted-foreground">If the money runs out, typically at age</dt>
          <dd className="font-semibold tabular-nums">{mc.median_depletion_age ?? 'never in most paths'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Median balance at {mc.ages.at(-1)} (today’s $)</dt>
          <dd className="font-semibold tabular-nums">{formatPrice(mc.terminal.median)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Assumed return / volatility</dt>
          <dd className="font-semibold tabular-nums">
            {formatPercent(out.assumptions.mu)} / {formatPercent(out.assumptions.sigma, 0)}
            {out.assumptions.source === 'portfolio' && <span className="ml-1 font-normal text-muted-foreground">from {out.assumptions.symbols.join(', ')}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Paths</dt>
          <dd className="font-semibold tabular-nums">{mc.n_sims.toLocaleString()}</dd>
        </div>
      </dl>
    </div>
  )
}
