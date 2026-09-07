import { useMemo } from 'react'
import { ApiError, type Candle } from '@/lib/api'
import { useHistories, useIndicators } from '@/lib/queries'
import { useTicker } from '@/lib/use-ticker'
import { useChartParams } from '@/lib/use-chart-params'
import { normaliseSeries } from '@/lib/compare'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyTicker } from '@/features/empty-ticker'
import { ChartControls } from './chart-controls'
import { ComparePicker } from './compare-picker'
import { CompareChart } from './compare-chart'
import { PriceChart } from './price-chart'

function errorMessage(error: unknown, ticker: string): string {
  if (error instanceof ApiError && error.isNotFound) return `No price history for ${ticker}.`
  return error instanceof Error ? error.message : 'Could not load chart data.'
}

export function ChartsPage() {
  const [ticker] = useTicker()
  const { period, interval, overlays, compare, setPeriod, setInterval, toggleOverlay, toggleCompare, setCompare } =
    useChartParams()
  const compareMode = compare.length > 0

  return (
    <section aria-labelledby="charts-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="charts-heading" className="text-2xl font-semibold">
          Charts{ticker && <span className="ml-2 font-mono text-muted-foreground">{ticker}</span>}
        </h1>
        {ticker && (
          <ChartControls
            period={period}
            interval={interval}
            overlays={overlays}
            onPeriod={setPeriod}
            onInterval={setInterval}
            onToggleOverlay={toggleOverlay}
            overlaysDisabled={compareMode}
          />
        )}
      </div>

      {ticker && (
        <ComparePicker primary={ticker} compare={compare} onToggle={toggleCompare} onClear={() => setCompare([])} />
      )}

      {!ticker ? (
        <EmptyTicker hint="Pick a symbol to see candlesticks with EMA, Bollinger Bands and support/resistance." />
      ) : compareMode ? (
        <CompareView ticker={ticker} compare={compare} period={period} interval={interval} />
      ) : (
        <IndicatorView ticker={ticker} period={period} interval={interval} overlays={overlays} />
      )}
    </section>
  )
}

type ViewProps = { ticker: string; period: ReturnType<typeof useChartParams>['period']; interval: ReturnType<typeof useChartParams>['interval'] }

function IndicatorView({ ticker, period, interval, overlays }: ViewProps & { overlays: ReturnType<typeof useChartParams>['overlays'] }) {
  const { data, isPending, isError, error, isFetching } = useIndicators(ticker, period, interval)
  if (isPending) return <Skeleton className="h-[480px] w-full" aria-busy aria-label="Loading chart" />
  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 p-6 text-sm text-destructive">
        {errorMessage(error, ticker)}
      </div>
    )
  }
  return (
    <div className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
      <PriceChart data={data} overlays={overlays} className="rounded-lg border" />
      <p className="mt-2 text-xs text-muted-foreground">
        {data.candles.length} bars · {interval === '1wk' ? 'weekly' : 'daily'} · Bollinger {data.bollinger.window}/
        {data.bollinger.k}σ · {data.levels.length} S/R levels
      </p>
    </div>
  )
}

function CompareView({ ticker, compare, period, interval }: ViewProps & { compare: string[] }) {
  const symbols = useMemo(() => [ticker, ...compare], [ticker, compare])
  const results = useHistories(symbols, period, interval)
  const anyPending = results.some((r) => r.isPending)
  const failed = results.flatMap((r, i) => (r.isError ? [{ symbol: symbols[i]!, error: r.error }] : []))
  const series = useMemo(() => {
    const input: Record<string, Candle[] | undefined> = {}
    symbols.forEach((s, i) => {
      input[s] = results[i]?.data?.candles
    })
    return normaliseSeries(input, interval)
  }, [symbols, results, interval])

  if (anyPending && series.length === 0) return <Skeleton className="h-[480px] w-full" aria-busy aria-label="Loading chart" />
  return (
    <div>
      <CompareChart series={series} interval={interval} className="rounded-lg border" />
      <p className="mt-2 text-xs text-muted-foreground">
        % change from the first shared bar · {interval === '1wk' ? 'weekly' : 'daily'} · indicator overlays are hidden in compare mode
      </p>
      {failed.length > 0 && (
        <ul role="alert" className="mt-2 text-xs text-destructive">
          {failed.map((f) => (
            <li key={f.symbol}>{errorMessage(f.error, f.symbol)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
