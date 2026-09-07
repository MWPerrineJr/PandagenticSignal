import { ApiError } from '@/lib/api'
import { useIndicators } from '@/lib/queries'
import { useTicker } from '@/lib/use-ticker'
import { useChartParams } from '@/lib/use-chart-params'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyTicker } from '@/features/empty-ticker'
import { ChartControls } from './chart-controls'
import { PriceChart } from './price-chart'

export function ChartsPage() {
  const [ticker] = useTicker()
  const { period, interval, overlays, setPeriod, setInterval, toggleOverlay } = useChartParams()
  const { data, isPending, isError, error, isFetching } = useIndicators(ticker, period, interval)

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
          />
        )}
      </div>

      {!ticker ? (
        <EmptyTicker hint="Pick a symbol to see candlesticks with EMA, Bollinger Bands and support/resistance." />
      ) : isPending ? (
        <Skeleton className="h-[480px] w-full" aria-busy aria-label="Loading chart" />
      ) : isError ? (
        <div role="alert" className="rounded-lg border border-destructive/40 p-6 text-sm text-destructive">
          {error instanceof ApiError && error.isNotFound
            ? `No price history for ${ticker}.`
            : error instanceof Error
              ? error.message
              : 'Could not load chart data.'}
        </div>
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <PriceChart data={data} overlays={overlays} className="rounded-lg border" />
          <p className="mt-2 text-xs text-muted-foreground">
            {data.candles.length} bars · {interval === '1wk' ? 'weekly' : 'daily'} · Bollinger {data.bollinger.window}/
            {data.bollinger.k}σ · {data.levels.length} S/R levels
          </p>
        </div>
      )}
    </section>
  )
}
