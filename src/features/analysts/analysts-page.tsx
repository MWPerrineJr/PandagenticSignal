import { ApiError } from '@/lib/api'
import { useQuote, useRecommendations } from '@/lib/queries'
import { useTicker } from '@/lib/use-ticker'
import { consensus, hasCoverage, upside } from '@/lib/analysts'
import { formatPct } from '@/lib/compare'
import { formatPrice } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyTicker } from '@/features/empty-ticker'
import { RecommendationBars } from './recommendation-bars'
import { PriceTargetGauge } from './price-target-gauge'
import { GradeTable } from './grade-table'

export function AnalystsPage() {
  const [ticker] = useTicker()
  const { data, isPending, isError, error } = useRecommendations(ticker)
  const quote = useQuote(ticker)

  return (
    <section aria-labelledby="analysts-heading" className="space-y-6">
      <h1 id="analysts-heading" className="text-2xl font-semibold">
        Analysts{ticker && <span className="ml-2 font-mono text-muted-foreground">{ticker}</span>}
      </h1>

      {!ticker ? (
        <EmptyTicker hint="Pick a symbol to see analyst ratings, price targets and rating changes." />
      ) : isPending ? (
        <div className="space-y-4" aria-busy aria-label="Loading analyst data">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-lg border border-destructive/40 p-6 text-sm text-destructive">
          {error instanceof ApiError && error.isNotFound
            ? `No data for ${ticker}.`
            : error instanceof Error
              ? error.message
              : 'Could not load analyst data.'}
        </div>
      ) : !hasCoverage(data) ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No analyst coverage for {ticker}. ETFs, funds and many small caps are not rated.
        </p>
      ) : (
        <Overview ticker={ticker} data={data} current={quote.data?.price ?? data.price_targets.current ?? null} />
      )}
    </section>
  )
}

function Overview({
  ticker,
  data,
  current,
}: {
  ticker: string
  data: NonNullable<ReturnType<typeof useRecommendations>['data']>
  current: number | null
}) {
  const latest = data.summary[0]
  const c = consensus(latest)
  const meanUpside = upside(current, data.price_targets.mean)
  const targets = { ...data.price_targets, current }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Consensus</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {c ? (
                <>
                  <Badge variant="secondary" data-testid="consensus-badge">{c.label}</Badge>
                  <span className="text-base font-normal text-muted-foreground tabular-nums">{c.score.toFixed(1)} / 5</span>
                </>
              ) : (
                <span className="text-base font-normal text-muted-foreground">No ratings</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{c ? `${c.analysts} analysts this month` : '—'}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Mean price target</CardDescription>
            <CardTitle className="text-2xl">{formatPrice(data.price_targets.mean)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {meanUpside != null ? (
              <span className={meanUpside >= 0 ? 'text-emerald-500' : 'text-red-500'}>{formatPct(meanUpside, 1)} vs current</span>
            ) : (
              '—'
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Current price</CardDescription>
            <CardTitle className="text-2xl">{formatPrice(current)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{ticker}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <RecommendationBars summary={data.summary} />
            {data.summary.length === 0 && <p className="text-sm text-muted-foreground">No monthly rating history.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <PriceTargetGauge targets={targets} />
            {(data.price_targets.low == null || data.price_targets.high == null) && (
              <p className="text-sm text-muted-foreground">No price-target range published.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <GradeTable rows={data.upgrades_downgrades} />
    </div>
  )
}
