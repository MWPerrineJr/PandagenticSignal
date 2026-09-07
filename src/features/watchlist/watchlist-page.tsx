import { ArrowDownIcon, ArrowUpIcon, XIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTickerStore, MAX_TRACKED } from '@/stores/tickers'
import { useTicker } from '@/lib/use-ticker'
import { useQuotes } from '@/lib/queries'
import { formatChange, formatCompact, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TickerSearch } from '@/features/search/ticker-search'
import { Sparkline } from './sparkline'

export function WatchlistPage() {
  const tracked = useTickerStore((s) => s.tickers)
  const add = useTickerStore((s) => s.add)
  const remove = useTickerStore((s) => s.remove)
  const move = useTickerStore((s) => s.move)
  const [ticker, setTicker] = useTicker()
  const navigate = useNavigate()
  const { data, isPending, isError, error } = useQuotes(tracked)
  const quotes = new Map(data?.quotes.map((q) => [q.symbol, q]))
  const missing = new Set(data?.missing ?? [])

  const open = (symbol: string) => {
    setTicker(symbol)
    navigate({ pathname: '/charts', search: `?t=${symbol}` })
  }

  return (
    <section aria-labelledby="watchlist-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="watchlist-heading" className="text-2xl font-semibold">
          Watchlist
          <span className="ml-2 text-base font-normal text-muted-foreground">
            {tracked.length}/{MAX_TRACKED}
          </span>
        </h1>
        <TickerSearch onSelect={add} label="Add a symbol to the watchlist" placeholder="Add a symbol or company" className="w-64 sm:w-80" />
      </div>

      {tracked.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing tracked yet. Add a symbol above, or press “Track” on the Dashboard.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Tracked symbols with latest quotes</caption>
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Symbol</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Price</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Change</th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">Volume</th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">Mkt cap</th>
                <th scope="col" className="hidden px-3 py-2 text-left font-medium sm:table-cell">1M trend</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tracked.map((symbol, i) => {
                const q = quotes.get(symbol)
                const up = (q?.change ?? 0) >= 0
                return (
                  <tr key={symbol} className={cn('hover:bg-muted/30', symbol === ticker && 'bg-muted/40')} data-testid={`row-${symbol}`}>
                    <th scope="row" className="px-3 py-2 text-left">
                      <button type="button" onClick={() => open(symbol)} className="font-mono font-semibold hover:underline">
                        {symbol}
                      </button>
                    </th>
                    {isPending ? (
                      <td colSpan={5} className="px-3 py-2">
                        <Skeleton className="h-4 w-40" />
                      </td>
                    ) : isError ? (
                      <td colSpan={5} className="px-3 py-2 text-destructive" role="alert">
                        {error instanceof Error ? error.message : 'Quotes unavailable'}
                      </td>
                    ) : !q ? (
                      <td colSpan={5} className="px-3 py-2 text-muted-foreground">
                        {missing.has(symbol) ? 'No data for this symbol' : '—'}
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums">{formatPrice(q.price, q.currency ?? 'USD')}</td>
                        <td className={cn('px-3 py-2 text-right tabular-nums', up ? 'text-emerald-500' : 'text-red-500')}>
                          {formatChange(q.change, q.change_pct)}
                        </td>
                        <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{formatCompact(q.volume)}</td>
                        <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{formatCompact(q.market_cap)}</td>
                        <td className="hidden px-3 py-1 sm:table-cell">
                          <Sparkline symbol={symbol} />
                        </td>
                      </>
                    )}
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon-sm" aria-label={`Move ${symbol} up`} disabled={i === 0} onClick={() => move(symbol, -1)}>
                        <ArrowUpIcon />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Move ${symbol} down`} disabled={i === tracked.length - 1} onClick={() => move(symbol, 1)}>
                        <ArrowDownIcon />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${symbol}`} onClick={() => remove(symbol)}>
                        <XIcon />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Quotes refresh every minute. Saved in this browser until you sign in (Phase 5).</p>
    </section>
  )
}
