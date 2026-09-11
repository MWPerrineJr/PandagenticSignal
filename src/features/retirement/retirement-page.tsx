import { useMemo, useState } from 'react'
import { PlayIcon } from 'lucide-react'
import { ApiError, type RetirementRequest, type Simulation } from '@/lib/api'
import { toRequestHoldings } from '@/lib/portfolio'
import { agesValid, depletionAge, projectDeterministic } from '@/lib/retirement'
import { useRetirementProjection } from '@/lib/queries'
import { usePortfolios } from '@/lib/use-portfolios'
import { useRetirementStore } from '@/stores/retirement'
import { formatPercent, formatPrice } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FanChart } from '@/features/portfolio/fan-chart'
import { NestEggChart } from './nest-egg-chart'
import { RetirementForm } from './retirement-form'
import { SuccessCard } from './success-card'

const N_SIMS = 2000

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNotFound) return `${error.message}. Fix the portfolio's holdings or switch to your own numbers.`
    if (error.status === 429) return 'Too many projections right now. Wait a minute and try again.'
    return error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}

export function RetirementPage() {
  const { inputs, source, set, setSource } = useRetirementStore()
  const { portfolios } = usePortfolios()
  const portfolio = source.kind === 'portfolio' ? (portfolios.find((p) => p.id === source.portfolioId) ?? null) : null
  const valid = agesValid(inputs)

  const request = useMemo<RetirementRequest | null>(() => {
    if (!valid) return null
    const base: RetirementRequest = { ...inputs, mode: 'parametric', n_sims: N_SIMS }
    if (source.kind === 'parametric') return base
    if (!portfolio || portfolio.holdings.length === 0) return null
    return { ...base, mode: 'portfolio', holdings: toRequestHoldings(portfolio.holdings, portfolio.mode), period: '2y' }
  }, [inputs, source, portfolio, valid])

  const [lastRun, setLastRun] = useState<RetirementRequest | null>(null)
  const current = lastRun && request && JSON.stringify(lastRun) === JSON.stringify(request) ? lastRun : null
  const projection = useRetirementProjection(current)
  const out = current ? projection.data : undefined

  // Instant deterministic path from the TS twin; the API's derived return wins once known.
  const mu = out?.assumptions.source === 'portfolio' ? out.assumptions.mu : inputs.expected_return
  const points = useMemo(() => projectDeterministic(inputs, mu), [inputs, mu])
  const atRetirement = points.find((p) => p.age === inputs.retirement_age)
  const runsOut = depletionAge(points, inputs.retirement_age)

  const fanSim = useMemo<Simulation | null>(() => {
    if (!out) return null
    const mc = out.monte_carlo
    return {
      initial_value: inputs.current_savings,
      horizon_years: mc.ages.length - 1,
      steps_per_year: 1,
      n_sims: mc.n_sims,
      times: mc.ages.map((a) => a - mc.ages[0]!),
      bands: mc.bands,
      terminal: mc.terminal,
      stats: { symbols: [], weights: [], period: '', start: '', end: '', n_obs: 0, annual_return: out.assumptions.mu, annual_vol: out.assumptions.sigma, sharpe: 0, max_drawdown: 0, assets: [], correlation: [] },
    }
  }, [out, inputs.current_savings])

  return (
    <section aria-labelledby="retirement-heading" className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="retirement-heading" className="text-2xl font-semibold">
          Retirement
        </h1>
        <p className="text-sm text-muted-foreground">Will the money last? Adjust the sliders, then run the Monte Carlo.</p>
      </div>

      <RetirementForm
        inputs={inputs}
        onChange={set}
        source={source}
        onSource={setSource}
        portfolios={portfolios}
        derived={out?.assumptions.source === 'portfolio' ? out.assumptions : null}
      />

      {!valid ? (
        <p role="alert" className="text-sm text-destructive">
          Ages must increase: current age, then retirement age, then the age you plan to.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3" data-testid="deterministic-summary">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Nest egg at {inputs.retirement_age}</p>
              <p className="text-2xl font-semibold tabular-nums">{formatPrice(atRetirement?.balance_nominal)}</p>
              <p className="text-xs text-muted-foreground">{formatPrice(atRetirement?.balance_real)} in today’s dollars</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">At a steady {formatPercent(mu)} return, the money</p>
              <p className={runsOut ? 'text-2xl font-semibold text-red-500' : 'text-2xl font-semibold text-emerald-500'}>
                {runsOut ? `runs out at ${runsOut}` : `lasts past ${inputs.life_expectancy}`}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Balance at {inputs.life_expectancy} (today’s $)</p>
              <p className="text-2xl font-semibold tabular-nums">{formatPrice(points.at(-1)?.balance_real)}</p>
            </div>
          </div>

          <NestEggChart points={points} retirementAge={inputs.retirement_age} />

          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Monte Carlo</h2>
            <Button size="sm" onClick={() => request && setLastRun(request)} disabled={!request || projection.isFetching}>
              <PlayIcon /> {projection.isFetching ? 'Running…' : 'Run Monte Carlo'}
            </Button>
            {source.kind === 'portfolio' && !portfolio && <span className="text-sm text-destructive">That portfolio no longer exists; pick another source.</span>}
          </div>
          {current && projection.isError ? (
            <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
              {errorMessage(projection.error)}
            </div>
          ) : out && fanSim ? (
            <div className="space-y-4">
              <SuccessCard out={out} />
              <FanChart
                sim={fanSim}
                title="Balance in today’s dollars"
                xLabel={(t) => `${Math.round(inputs.current_age + t)}`}
                caption={`${out.monte_carlo.n_sims.toLocaleString()} paths, yearly steps`}
                baselineLabel="Current savings"
              />
            </div>
          ) : current && projection.isFetching ? (
            <Skeleton className="h-64 w-full" aria-busy aria-label="Running Monte Carlo" />
          ) : (
            <p className="text-sm text-muted-foreground">
              The projection above assumes the same return every year. Monte Carlo draws {N_SIMS.toLocaleString()} random return sequences to show how likely the plan is to hold.
            </p>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Illustrative only, not financial advice. Spending is inflation-adjusted; balances shown in today’s dollars are deflated by your inflation input. Inputs stay in this browser.
      </p>
    </section>
  )
}
