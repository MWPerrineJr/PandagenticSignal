import type { Simulation } from '@/lib/api'
import { formatPercent, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Terminal-value tiles: central outcomes and the downside measured against money put in. */
export function TerminalStats({ sim }: { sim: Simulation }) {
  const t = sim.terminal
  const tiles: Array<{ label: string; value: string; sub?: string; tone?: 'up' | 'down' }> = [
    { label: 'Median outcome', value: formatPrice(t.median), sub: `mean ${formatPrice(t.mean)}`, tone: 'up' },
    { label: 'Likely range (5th–95th)', value: `${formatPrice(t.p5)} – ${formatPrice(t.p95)}` },
    { label: 'Chance of ending below what you put in', value: formatPercent(t.prob_loss, 0), tone: (t.prob_loss ?? 0) > 0.25 ? 'down' : undefined },
    { label: 'Value at risk (95%)', value: formatPrice(t.var_95), sub: `${formatPercent(t.var_95_pct)} of contributions · shortfall beyond it averages ${formatPrice(t.cvar_95)}`, tone: (t.var_95 ?? 0) > 0 ? 'down' : undefined },
  ]
  return (
    <div className="space-y-2" data-testid="terminal-stats">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border bg-card p-3">
            <dt className="text-xs text-muted-foreground">{tile.label}</dt>
            <dd className={cn('text-lg font-semibold tabular-nums', tile.tone === 'up' && 'text-emerald-500', tile.tone === 'down' && 'text-red-500')}>{tile.value}</dd>
            {tile.sub && <dd className="text-xs text-muted-foreground">{tile.sub}</dd>}
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        {sim.n_sims.toLocaleString()} correlated paths, {sim.steps_per_year === 252 ? 'daily' : sim.steps_per_year === 52 ? 'weekly' : 'monthly'} steps, rebalanced to target
        weights, moments from the {sim.stats.period} history. Past returns do not predict future results.
      </p>
    </div>
  )
}
