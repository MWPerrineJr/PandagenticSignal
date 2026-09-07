import { useTicker } from '@/lib/use-ticker'
import { useTickerStore } from '@/stores/tickers'
import { Button } from '@/components/ui/button'
import { EmptyTicker } from '@/features/empty-ticker'
import { QuoteCard } from '@/features/quote/quote-card'

export function DashboardPage() {
  const [ticker] = useTicker()
  const tracked = useTickerStore((s) => s.tickers)
  const toggle = useTickerStore((s) => s.toggle)
  const isTracked = ticker ? tracked.includes(ticker) : false

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 id="dashboard-heading" className="text-2xl font-semibold">
          Dashboard
        </h1>
        {ticker && (
          <Button variant={isTracked ? 'secondary' : 'default'} onClick={() => toggle(ticker)}>
            {isTracked ? `Untrack ${ticker}` : `Track ${ticker}`}
          </Button>
        )}
      </div>
      {ticker ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <QuoteCard symbol={ticker} />
        </div>
      ) : (
        <EmptyTicker />
      )}
      <p className="text-sm text-muted-foreground">
        Customizable widgets arrive in Phase 6. Tracking {tracked.length} symbol{tracked.length === 1 ? '' : 's'}.
      </p>
    </section>
  )
}
