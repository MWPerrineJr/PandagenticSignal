import { ApiError } from '@/lib/api'
import { useIndicators } from '@/lib/queries'
import type { OverlayId } from '@/lib/chart-data'
import { Skeleton } from '@/components/ui/skeleton'
import { QuoteCard } from '@/features/quote/quote-card'
import { PriceChart } from '@/features/charts/price-chart'

const OVERLAYS = new Set<OverlayId>(['ema10', 'ema30'])

/** Quote card plus a six-month daily chart for the selected coin. */
export function CoinDetail({ symbol }: { symbol: string }) {
  const { data, isPending, isError, error } = useIndicators(symbol, '6mo', '1d')
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_2fr]" data-testid="coin-detail">
      <QuoteCard symbol={symbol} />
      {isPending ? (
        <Skeleton className="h-[360px] w-full" aria-busy aria-label="Loading chart" />
      ) : isError ? (
        <div role="alert" className="rounded-lg border border-destructive/40 p-6 text-sm text-destructive">
          {error instanceof ApiError && error.isNotFound ? `No price history for ${symbol}.` : error.message}
        </div>
      ) : (
        <PriceChart data={data} overlays={OVERLAYS} height={360} className="rounded-lg border" />
      )}
    </div>
  )
}
