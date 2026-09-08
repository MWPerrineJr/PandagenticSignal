import { Link } from 'react-router-dom'
import { useWatchlist } from '@/lib/use-watchlist'
import { useQuotes } from '@/lib/queries'
import { useTicker } from '@/lib/use-ticker'
import { formatChange, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { WidgetProps, WidgetSettingsProps } from './registry'

export function WatchlistWidget({ config }: WidgetProps<'watchlist'>) {
  const { tickers } = useWatchlist()
  const [active, setTicker] = useTicker()
  const shown = tickers.slice(0, config.limit)
  const { data } = useQuotes(shown)
  const quotes = new Map(data?.quotes.map((q) => [q.symbol, q]))

  if (shown.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Nothing tracked yet.{' '}
        <Link to="/watchlist" className="underline underline-offset-4">
          Add symbols
        </Link>
        .
      </p>
    )
  }
  return (
    <ul className="divide-y text-sm">
      {shown.map((symbol) => {
        const q = quotes.get(symbol)
        const up = (q?.change ?? 0) >= 0
        return (
          <li key={symbol}>
            <button
              type="button"
              onClick={() => setTicker(symbol)}
              className={cn('flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-muted/40', symbol === active && 'bg-muted/40')}
            >
              <span className="w-16 font-mono font-semibold">{symbol}</span>
              <span className="ml-auto tabular-nums">{q ? formatPrice(q.price, q.currency ?? 'USD') : '—'}</span>
              <span className={cn('w-28 text-right text-xs tabular-nums', q && (up ? 'text-emerald-500' : 'text-red-500'))}>
                {q ? formatChange(q.change, q.change_pct) : ''}
              </span>
            </button>
          </li>
        )
      })}
      {tickers.length > shown.length && (
        <li className="px-3 py-1.5 text-xs text-muted-foreground">
          +{tickers.length - shown.length} more on the{' '}
          <Link to="/watchlist" className="underline underline-offset-4">
            Watchlist tab
          </Link>
        </li>
      )}
    </ul>
  )
}

export function WatchlistWidgetSettings({ config, onChange }: WidgetSettingsProps<'watchlist'>) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-16 text-muted-foreground">Rows</span>
      <input
        type="number"
        min={1}
        max={20}
        value={config.limit}
        onChange={(e) => onChange({ limit: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })}
        className="h-7 w-16 rounded-md border bg-background px-2 text-xs"
        aria-label="Rows to show"
      />
    </label>
  )
}
