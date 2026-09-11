import { useEffect, useMemo } from 'react'
import { ApiError, type Candle } from '@/lib/api'
import { useHistories, useIndicatorCatalog, useIndicators } from '@/lib/queries'
import { useTicker } from '@/lib/use-ticker'
import { useChartParams } from '@/lib/use-chart-params'
import { useIndicatorSelection } from '@/lib/use-indicator-selection'
import { normaliseTokens } from '@/lib/indicators'
import { normaliseSeries } from '@/lib/compare'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyTicker } from '@/features/empty-ticker'
import { ChartControls } from './chart-controls'
import { ComparePicker } from './compare-picker'
import { CompareChart } from './compare-chart'
import { IndicatorPicker } from './indicator-picker'
import { PriceChart } from './price-chart'

function errorMessage(error: unknown, ticker: string): string {
  if (error instanceof ApiError && error.isNotFound) return `No price history for ${ticker}.`
  return error instanceof Error ? error.message : 'Could not load chart data.'
}

export function ChartsPage() {
  const [ticker] = useTicker()
  const { period, interval, compare, sharedIndicators, clearSharedIndicators, setPeriod, setInterval, toggleCompare, setCompare } =
    useChartParams()
  const catalog = useIndicatorCatalog()
  const selection = useIndicatorSelection()
  const compareMode = compare.length > 0

  // A shared link (`?ind=…`) replaces the saved selection once, then leaves the URL.
  useEffect(() => {
    if (!sharedIndicators || !catalog.data) return
    selection.setTokens(normaliseTokens(sharedIndicators, catalog.data))
    clearSharedIndicators()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedIndicators, catalog.data])

  return (
    <section aria-labelledby="charts-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="charts-heading" className="text-2xl font-semibold">
          Charts{ticker && <span className="ml-2 font-mono text-muted-foreground">{ticker}</span>}
        </h1>
        {ticker && (
          <div className="flex flex-wrap items-center gap-3">
            <ChartControls period={period} interval={interval} onPeriod={setPeriod} onInterval={setInterval} />
            <IndicatorPicker
              catalog={catalog.data}
              tokens={selection.tokens}
              onChange={selection.setTokens}
              onReset={selection.reset}
              disabled={compareMode}
            />
          </div>
        )}
      </div>

      {ticker && (
        <ComparePicker primary={ticker} compare={compare} onToggle={toggleCompare} onClear={() => setCompare([])} />
      )}

      {!ticker ? (
        <EmptyTicker hint="Pick a symbol to see candlesticks with your choice of indicators." />
      ) : compareMode ? (
        <CompareView ticker={ticker} compare={compare} period={period} interval={interval} />
      ) : (
        <IndicatorView ticker={ticker} period={period} interval={interval} tokens={selection.tokens} source={selection.source} />
      )}
    </section>
  )
}

type ViewProps = { ticker: string; period: ReturnType<typeof useChartParams>['period']; interval: ReturnType<typeof useChartParams>['interval'] }

function IndicatorView({ ticker, period, interval, tokens, source }: ViewProps & { tokens: string[]; source: 'local' | 'cloud' }) {
  const { data, isPending, isError, error, isFetching } = useIndicators(ticker, period, interval, tokens)
  if (isPending) return <Skeleton className="h-[480px] w-full" aria-busy aria-label="Loading chart" />
  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 p-6 text-sm text-destructive">
        {errorMessage(error, ticker)}
      </div>
    )
  }
  const panes = Object.values(data.series).filter((s) => s.kind === 'pane').length
  return (
    <div className="space-y-2">
      <PriceChart data={data} className="rounded-lg border" height={480 + panes * 120} />
      <p className="text-xs text-muted-foreground">
        {data.candles.length} bars · {interval === '1wk' ? 'weekly' : 'daily'} · {Object.keys(data.series).length} indicators
        {source === 'cloud' ? ' · selection saved to your account' : ' · selection saved in this browser'}
        {isFetching && ' · updating…'}
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
