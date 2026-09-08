import { ApiError } from '@/lib/api'
import { useQuote } from '@/lib/queries'
import { formatChange, formatCompact, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function QuoteCard({ symbol, className }: { symbol: string; className?: string }) {
  const { data, isPending, isError, error } = useQuote(symbol)

  if (isPending) {
    return (
      <Card className={className} aria-busy>
        <CardHeader>
          <CardTitle>{symbol}</CardTitle>
          <CardDescription>Loading quote…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    const message =
      error instanceof ApiError && error.isNotFound
        ? `No data for ${symbol}. Check the symbol and try again.`
        : error instanceof Error ? error.message : String(error)
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{symbol}</CardTitle>
          <CardDescription role="alert" className="text-destructive">
            {message}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const up = (data.change ?? 0) >= 0
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="font-mono text-base">{data.symbol}</CardTitle>
        <CardDescription>
          {data.exchange ?? '—'} · {data.currency ?? 'USD'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tabular-nums">{formatPrice(data.price, data.currency ?? 'USD')}</div>
        <div className={cn('text-sm tabular-nums', up ? 'text-emerald-500' : 'text-red-500')}>
          {formatChange(data.change, data.change_pct)}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Volume</dt>
          <dd className="text-right tabular-nums">{formatCompact(data.volume)}</dd>
          <dt className="text-muted-foreground">Market cap</dt>
          <dd className="text-right tabular-nums">{formatCompact(data.market_cap)}</dd>
          <dt className="text-muted-foreground">Day range</dt>
          <dd className="text-right tabular-nums">
            {formatPrice(data.day_low)} – {formatPrice(data.day_high)}
          </dd>
          <dt className="text-muted-foreground">52-week range</dt>
          <dd className="text-right tabular-nums">
            {formatPrice(data.year_low)} – {formatPrice(data.year_high)}
          </dd>
        </dl>
      </CardContent>
    </Card>
  )
}
