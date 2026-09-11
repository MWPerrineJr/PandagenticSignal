import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, type SimulateRequest } from '@/lib/api'
import { PERIOD_LABELS, PORTFOLIO_PERIODS, holdingsKey, toRequestHoldings, type PortfolioPeriod } from '@/lib/portfolio'
import { usePortfolioStats, useSimulation } from '@/lib/queries'
import { usePortfolios } from '@/lib/use-portfolios'
import { Skeleton } from '@/components/ui/skeleton'
import { CorrelationMatrix } from './correlation-matrix'
import { FanChart } from './fan-chart'
import { HoldingsEditor } from './holdings-editor'
import { PortfolioPicker } from './portfolio-picker'
import { SimulationControls, type SimulationParams } from './simulation-controls'
import { StatsCards } from './stats-cards'
import { TerminalStats } from './terminal-stats'

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNotFound) return `${error.message}. Remove the unknown symbol to continue.`
    if (error.status === 422) return error.message
    if (error.status === 429) return 'Too many simulations right now. Wait a minute and try again.'
    return error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}

export function PortfolioPage() {
  const pf = usePortfolios()
  const active = pf.active
  const [period, setPeriod] = useState<PortfolioPeriod>('2y')
  const holdings = active?.holdings ?? []
  const mode = active?.mode ?? 'weight'
  const key = holdingsKey(holdings, mode)

  const request = useMemo(() => (holdings.length ? { holdings: toRequestHoldings(holdings, mode), period } : null), [key, period]) // eslint-disable-line react-hooks/exhaustive-deps
  const stats = usePortfolioStats(request)

  // The last run is tied to the holdings and period it was made for: a changed portfolio
  // hides the stale projection until the user runs it again.
  const [lastRun, setLastRun] = useState<{ key: string; period: PortfolioPeriod; req: SimulateRequest } | null>(null)
  const simRequest = lastRun && lastRun.key === key && lastRun.period === period ? lastRun.req : null
  const sim = useSimulation(simRequest)
  const simData = simRequest ? sim.data : undefined
  const run = (p: SimulationParams) => request && setLastRun({ key, period, req: { ...request, ...p } })

  return (
    <section aria-labelledby="portfolio-heading" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="portfolio-heading" className="text-2xl font-semibold">
          Portfolio
        </h1>
        <PortfolioPicker portfolios={pf.portfolios} active={active} onSelect={pf.select} onCreate={(n) => pf.create(n)} onRename={pf.rename} onRemove={pf.remove} />
        {pf.isSaving && <span className="text-xs text-muted-foreground">Saving…</span>}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">History</span>
          <select aria-label="History period" className="h-8 rounded-md border bg-background px-2 text-sm" value={period} onChange={(e) => setPeriod(e.target.value as PortfolioPeriod)}>
            {PORTFOLIO_PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pf.error && (
        <p role="alert" className="text-sm text-destructive">
          {pf.error}
        </p>
      )}

      {pf.isLoading || !active ? (
        <Skeleton className="h-48 w-full" aria-busy aria-label="Loading portfolio" />
      ) : (
        <HoldingsEditor holdings={holdings} mode={mode} onChange={pf.update} />
      )}

      {active && holdings.length > 0 && (
        <>
          {stats.isPending ? (
            <Skeleton className="h-28 w-full" aria-busy aria-label="Loading portfolio statistics" />
          ) : stats.isError ? (
            <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
              {errorMessage(stats.error)}
            </div>
          ) : (
            <div className={stats.isFetching ? 'space-y-4 opacity-70 transition-opacity' : 'space-y-4 transition-opacity'}>
              <StatsCards stats={stats.data} />
              <CorrelationMatrix stats={stats.data} />
            </div>
          )}

          <h2 className="text-lg font-semibold">Monte Carlo projection</h2>
          <SimulationControls onRun={run} running={sim.isFetching} disabled={stats.isError} />
          {sim.isError ? (
            <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
              {errorMessage(sim.error)}
            </div>
          ) : simData ? (
            <div className={sim.isFetching ? 'space-y-4 opacity-70' : 'space-y-4'}>
              <FanChart sim={simData} />
              <TerminalStats sim={simData} />
            </div>
          ) : sim.isFetching ? (
            <Skeleton className="h-80 w-full" aria-busy aria-label="Running simulation" />
          ) : (
            <p className="text-sm text-muted-foreground">Set a horizon and contributions, then run the simulation to see the range of outcomes.</p>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {pf.source === 'cloud' ? (
          'Portfolios sync to your account.'
        ) : (
          <>
            Portfolios are saved in this browser.{' '}
            <Link to="/login" state={{ from: '/portfolio' }} className="underline underline-offset-4 hover:text-foreground">
              Sign in
            </Link>{' '}
            to sync across devices.
          </>
        )}
      </p>
    </section>
  )
}
