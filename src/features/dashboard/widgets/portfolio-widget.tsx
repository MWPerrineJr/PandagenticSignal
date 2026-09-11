import { Link } from 'react-router-dom'
import { ApiError } from '@/lib/api'
import { formatPercent } from '@/lib/format'
import { toRequestHoldings, weightsFromHoldings } from '@/lib/portfolio'
import { usePortfolioStats } from '@/lib/queries'
import { usePortfolios } from '@/lib/use-portfolios'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetProps, WidgetSettingsProps } from './registry'

const TOP_ROWS = 6

export function PortfolioWidget({ config }: WidgetProps<'portfolio'>) {
  const pf = usePortfolios()
  const portfolio = (config.portfolioId ? pf.portfolios.find((p) => p.id === config.portfolioId) : pf.active) ?? null
  const holdings = portfolio?.holdings ?? []
  const stats = usePortfolioStats(portfolio && holdings.length ? { holdings: toRequestHoldings(holdings, portfolio.mode), period: '2y' } : null)

  if (pf.isLoading) return <Skeleton className="h-full w-full rounded-none" aria-busy aria-label="Loading portfolio" />
  if (!portfolio || holdings.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {portfolio ? `“${portfolio.name}” has no holdings yet.` : 'No portfolio selected.'}{' '}
        <Link to="/portfolio" className="underline underline-offset-4">
          Open the Portfolio tab
        </Link>
        .
      </p>
    )
  }
  const weights = weightsFromHoldings(holdings)
  const rows = holdings.map((h, i) => ({ symbol: h.symbol, weight: weights[i]! })).sort((a, b) => b.weight - a.weight)
  const shown = rows.slice(0, TOP_ROWS)
  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex items-baseline justify-between gap-2 px-3 pt-2">
        <span className="truncate font-medium">{portfolio.name}</span>
        <span className="text-xs text-muted-foreground">{holdings.length} holdings</span>
      </div>
      <dl className="grid grid-cols-3 gap-2 px-3 py-2 text-xs" data-testid="portfolio-widget-stats">
        {stats.isError ? (
          <dd role="alert" className="col-span-3 text-destructive">
            {stats.error instanceof ApiError ? stats.error.message : 'Stats unavailable'}
          </dd>
        ) : (
          (
            [
              ['Return', stats.data ? formatPercent(stats.data.annual_return) : '…', stats.data && stats.data.annual_return < 0 ? 'text-red-500' : 'text-emerald-500'],
              ['Volatility', stats.data ? formatPercent(stats.data.annual_vol) : '…', ''],
              ['Sharpe', stats.data ? stats.data.sharpe.toFixed(2) : '…', ''],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={cn('font-semibold tabular-nums', stats.data && tone)}>{value}</dd>
            </div>
          ))
        )}
      </dl>
      <ul className="divide-y border-t">
        {shown.map((r) => (
          <li key={r.symbol} className="flex items-center gap-3 px-3 py-1" data-testid={`portfolio-row-${r.symbol}`}>
            <span className="w-20 font-mono font-semibold">{r.symbol}</span>
            <span className="h-1.5 flex-1 rounded bg-muted">
              <span className="block h-full rounded bg-primary" style={{ width: `${Math.round(r.weight * 100)}%` }} aria-hidden />
            </span>
            <span className="w-12 text-right text-xs tabular-nums">{formatPercent(r.weight, 0)}</span>
          </li>
        ))}
        {rows.length > shown.length && (
          <li className="px-3 py-1 text-xs text-muted-foreground">
            +{rows.length - shown.length} more on the{' '}
            <Link to="/portfolio" className="underline underline-offset-4">
              Portfolio tab
            </Link>
          </li>
        )}
      </ul>
    </div>
  )
}

export function PortfolioWidgetSettings({ config, onChange }: WidgetSettingsProps<'portfolio'>) {
  const { portfolios } = usePortfolios()
  return (
    <label className="flex items-center gap-2">
      <span className="w-16 text-muted-foreground">Portfolio</span>
      <select
        className="h-7 rounded-md border bg-background px-2 text-xs"
        value={config.portfolioId ?? ''}
        onChange={(e) => onChange({ portfolioId: e.target.value || null })}
        aria-label="Portfolio to show"
      >
        <option value="">Active portfolio</option>
        {portfolios.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}
