import { ApiError } from '@/lib/api'
import { useIndicatorCatalog, useIndicators } from '@/lib/queries'
import { useIndicatorSelection } from '@/lib/use-indicator-selection'
import { Skeleton } from '@/components/ui/skeleton'
import { QuoteCard } from '@/features/quote/quote-card'
import { IndicatorPicker } from '@/features/charts/indicator-picker'
import { PriceChart } from '@/features/charts/price-chart'
import { SentimentPanel } from '@/features/sentiment/sentiment-panel'

/** Quote card plus a six-month daily chart for the selected coin, with the same indicator
 * selection as the Charts tab (it is one setting, saved to the account or this browser). */
export function CoinDetail({ symbol }: { symbol: string }) {
  const catalog = useIndicatorCatalog()
  const selection = useIndicatorSelection()
  const { data, isPending, isError, error } = useIndicators(symbol, '6mo', '1d', selection.tokens)
  const panes = data ? Object.values(data.series).filter((s) => s.kind === 'pane').length : 0
  return (
    <div className="space-y-4" data-testid="coin-detail">
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_2fr]">
        <QuoteCard symbol={symbol} />
        <div className="space-y-2">
          <div className="flex justify-end">
            <IndicatorPicker catalog={catalog.data} tokens={selection.tokens} onChange={selection.setTokens} onReset={selection.reset} />
          </div>
          {isPending ? (
            <Skeleton className="h-[360px] w-full" aria-busy aria-label="Loading chart" />
          ) : isError ? (
            <div role="alert" className="rounded-lg border border-destructive/40 p-6 text-sm text-destructive">
              {error instanceof ApiError && error.isNotFound ? `No price history for ${symbol}.` : error.message}
            </div>
          ) : (
            <PriceChart data={data} height={360 + panes * 100} className="rounded-lg border" />
          )}
        </div>
      </div>
      <SentimentPanel key={symbol} symbol={symbol} />
    </div>
  )
}
