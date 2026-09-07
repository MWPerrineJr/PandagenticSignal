import { useTicker } from '@/lib/use-ticker'
import { EmptyTicker } from '@/features/empty-ticker'

export function ChartsPage() {
  const [ticker] = useTicker()
  return (
    <section aria-labelledby="charts-heading" className="space-y-6">
      <h1 id="charts-heading" className="text-2xl font-semibold">
        Charts
      </h1>
      {ticker ? (
        <p className="text-muted-foreground">
          Candlestick chart for <span className="font-mono text-foreground">{ticker}</span> with EMA, Bollinger
          Bands and support/resistance arrives in Phase 3.
        </p>
      ) : (
        <EmptyTicker />
      )}
    </section>
  )
}
