import { useTickerStore } from '@/stores/tickers'
import { useTicker } from '@/lib/use-ticker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function WatchlistPage() {
  const tracked = useTickerStore((s) => s.tickers)
  const remove = useTickerStore((s) => s.remove)
  const [, setTicker] = useTicker()

  return (
    <section aria-labelledby="watchlist-heading" className="space-y-6">
      <h1 id="watchlist-heading" className="text-2xl font-semibold">
        Watchlist
      </h1>
      {tracked.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing tracked yet. Select a ticker and press “Track” on the Dashboard. Live rows and compare mode
          arrive in Phase 4.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tracked.map((symbol) => (
            <li key={symbol} className="flex items-center gap-3 px-4 py-2">
              <Badge variant="outline" className="font-mono">
                {symbol}
              </Badge>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setTicker(symbol)}>
                Select
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(symbol)} aria-label={`Remove ${symbol}`}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
