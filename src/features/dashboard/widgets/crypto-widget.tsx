import { Link } from 'react-router-dom'
import { ApiError } from '@/lib/api'
import { useCryptoTop } from '@/lib/queries'
import { useTicker } from '@/lib/use-ticker'
import { formatPct, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetProps, WidgetSettingsProps } from './registry'

export function CryptoWidget({ config }: WidgetProps<'crypto'>) {
  const { data, isPending, isError, error } = useCryptoTop(config.limit)
  const [active, setTicker] = useTicker()

  if (isPending) return <Skeleton className="h-full w-full rounded-none" aria-busy aria-label="Loading top coins" />
  if (isError) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {error instanceof ApiError ? error.message : 'Could not load the crypto market.'}
      </p>
    )
  }
  return (
    <ul className="divide-y text-sm">
      {data.coins.map((coin) => {
        const up = (coin.change_pct ?? 0) >= 0
        return (
          <li key={coin.symbol} data-testid={`crypto-row-${coin.symbol}`}>
            <button
              type="button"
              onClick={() => setTicker(coin.symbol)}
              className={cn('flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-muted/40', coin.symbol === active && 'bg-muted/40')}
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{coin.name}</span>{' '}
                <span className="font-mono text-xs text-muted-foreground">{coin.symbol}</span>
              </span>
              <span className="tabular-nums">{formatPrice(coin.price)}</span>
              <span className={cn('w-16 text-right text-xs tabular-nums', up ? 'text-emerald-500' : 'text-red-500')}>
                {formatPct(coin.change_pct)}
              </span>
            </button>
          </li>
        )
      })}
      <li className="px-3 py-1.5 text-xs text-muted-foreground">
        <Link to="/crypto" className="underline underline-offset-4">
          Full market on the Crypto tab
        </Link>
      </li>
    </ul>
  )
}

export function CryptoWidgetSettings({ config, onChange }: WidgetSettingsProps<'crypto'>) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-16 text-muted-foreground">Coins</span>
      <input
        type="number"
        min={1}
        max={20}
        value={config.limit}
        onChange={(e) => onChange({ limit: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })}
        className="h-7 w-16 rounded-md border bg-background px-2 text-xs"
        aria-label="Coins to show"
      />
    </label>
  )
}
