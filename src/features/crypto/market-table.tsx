import { StarIcon } from 'lucide-react'
import type { CryptoQuote } from '@/lib/api'
import { formatCompact, formatPct, formatPrice } from '@/lib/format'
import { useWatchlist } from '@/lib/use-watchlist'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sparkline } from '@/features/watchlist/sparkline'

export interface MarketTableProps {
  coins: CryptoQuote[]
  activeSymbol: string | null
  onSelect: (symbol: string) => void
}

/** Top coins by market cap. Clicking a symbol selects it app-wide; the star tracks it in the watchlist. */
export function MarketTable({ coins, activeSymbol, onSelect }: MarketTableProps) {
  const { has, toggle } = useWatchlist()
  return (
    <div className="rounded-lg border">
      <Table>
        <caption className="sr-only">Top cryptocurrencies by market cap</caption>
        <TableHeader className="bg-muted/40 text-xs text-muted-foreground">
          <TableRow>
            <TableHead className="w-8 text-right">#</TableHead>
            <TableHead>Coin</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">24h</TableHead>
            <TableHead className="hidden text-right md:table-cell">Market cap</TableHead>
            <TableHead className="hidden text-right md:table-cell">Volume (24h)</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Supply</TableHead>
            <TableHead className="hidden sm:table-cell">1M trend</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Track</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coins.map((coin, i) => {
            const up = (coin.change_pct ?? 0) >= 0
            const tracked = has(coin.symbol)
            return (
              <TableRow
                key={coin.symbol}
                data-testid={`row-${coin.symbol}`}
                className={cn('hover:bg-muted/30', coin.symbol === activeSymbol && 'bg-muted/40')}
              >
                <TableCell className="text-right text-muted-foreground tabular-nums">{coin.rank ?? i + 1}</TableCell>
                <TableCell>
                  <button type="button" onClick={() => onSelect(coin.symbol)} className="flex items-center gap-2 text-left hover:underline">
                    {coin.icon && <img src={coin.icon} alt="" width={20} height={20} className="size-5 shrink-0 rounded-full" loading="lazy" />}
                    <span>
                      <span className="block font-medium">{coin.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {coin.symbol}
                        {coin.price_source === 'coingecko' && <span title="Not traded on Coinbase; price from CoinGecko"> · CG</span>}
                      </span>
                    </span>
                  </button>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatPrice(coin.price)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', up ? 'text-emerald-500' : 'text-red-500')}>
                  {formatPct(coin.change_pct)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{formatCompact(coin.market_cap)}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{formatCompact(coin.volume)}</TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatCompact(coin.circulating_supply)}</TableCell>
                <TableCell className="hidden py-1 sm:table-cell">
                  <Sparkline symbol={coin.symbol} />
                </TableCell>
                <TableCell className="py-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${tracked ? 'Untrack' : 'Track'} ${coin.symbol}`}
                    aria-pressed={tracked}
                    onClick={() => toggle(coin.symbol)}
                  >
                    <StarIcon className={cn(tracked && 'fill-current text-amber-500')} />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
