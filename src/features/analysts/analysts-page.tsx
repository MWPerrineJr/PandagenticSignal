import { useTicker } from '@/lib/use-ticker'
import { EmptyTicker } from '@/features/empty-ticker'

export function AnalystsPage() {
  const [ticker] = useTicker()
  return (
    <section aria-labelledby="analysts-heading" className="space-y-6">
      <h1 id="analysts-heading" className="text-2xl font-semibold">
        Analysts
      </h1>
      {ticker ? (
        <p className="text-muted-foreground">
          Recommendation history, price targets and upgrades/downgrades for{' '}
          <span className="font-mono text-foreground">{ticker}</span> arrive in Phase 4.
        </p>
      ) : (
        <EmptyTicker />
      )}
    </section>
  )
}
