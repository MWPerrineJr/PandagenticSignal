import type { PortfolioStats } from '@/lib/api'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Four KPI tiles plus the sample the numbers came from. */
export function StatsCards({ stats }: { stats: PortfolioStats }) {
  const tiles: Array<{ label: string; value: string; tone?: 'up' | 'down'; hint: string }> = [
    { label: 'Annual return', value: formatPercent(stats.annual_return), tone: stats.annual_return >= 0 ? 'up' : 'down', hint: 'Mean log return, annualised' },
    { label: 'Volatility', value: formatPercent(stats.annual_vol), hint: 'Annualised standard deviation' },
    { label: 'Sharpe', value: stats.sharpe.toFixed(2), hint: 'Return per unit of risk, rf = 0' },
    { label: 'Max drawdown', value: formatPercent(stats.max_drawdown), tone: 'down', hint: 'Worst peak-to-trough fall' },
  ]
  return (
    <div className="space-y-2" data-testid="stats-cards">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border bg-card p-3" title={t.hint}>
            <dt className="text-xs text-muted-foreground">{t.label}</dt>
            <dd className={cn('text-2xl font-semibold tabular-nums', t.tone === 'up' && 'text-emerald-500', t.tone === 'down' && 'text-red-500')}>
              {t.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Based on {stats.n_obs} shared trading days, {stats.start} to {stats.end}. Weights are rebalanced daily in the estimate.
      </p>
    </div>
  )
}
