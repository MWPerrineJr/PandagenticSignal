import { isCryptoQuote } from '@/lib/api'
import { useCryptoTop, useQuote } from '@/lib/queries'
import { useTicker } from '@/lib/use-ticker'
import { Skeleton } from '@/components/ui/skeleton'
import { CoinDetail } from './coin-detail'
import { MarketTable } from './market-table'

const TOP_N = 25

export function CryptoPage() {
  const [ticker, setTicker] = useTicker()
  const { data, isPending, isError, error, isFetching } = useCryptoTop(TOP_N)
  // The header ticker may be a stock; only show the detail panel for a coin.
  const inTable = Boolean(ticker && data?.coins.some((c) => c.symbol === ticker))
  const quote = useQuote(inTable ? null : ticker)
  const selected = ticker && (inTable || isCryptoQuote(quote.data)) ? ticker : null
  const notCrypto = Boolean(ticker && !selected && quote.isSuccess)

  return (
    <section aria-labelledby="crypto-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="crypto-heading" className="text-2xl font-semibold">
          Crypto{selected && <span className="ml-2 font-mono text-muted-foreground">{selected}</span>}
        </h1>
        {data && (
          <p className="text-xs text-muted-foreground">
            Top {data.coins.length} by market cap · as of {new Date(data.as_of * 1000).toLocaleTimeString()}
            {isFetching && ' · refreshing…'}
          </p>
        )}
      </div>

      {selected && <CoinDetail symbol={selected} />}
      {notCrypto && (
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{ticker}</span> is not a cryptocurrency. Pick a coin below to see its quote and chart.
        </p>
      )}

      {isPending ? (
        <Skeleton className="h-96 w-full" aria-busy aria-label="Loading top coins" />
      ) : isError ? (
        <div role="alert" className="rounded-lg border border-destructive/40 p-6 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load the crypto market.'}
        </div>
      ) : (
        <MarketTable coins={data.coins} activeSymbol={selected} onSelect={setTicker} />
      )}
      <p className="text-xs text-muted-foreground">
        Ranking, market cap and supply from CoinGecko; prices, 24h stats and charts from Coinbase (CG marks coins Coinbase does not
        trade). Refreshes every minute; coins trade around the clock, so “24h” replaces the daily session.
      </p>
    </section>
  )
}
