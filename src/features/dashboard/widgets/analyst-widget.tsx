import { ApiError } from '@/lib/api'
import { useQuote, useRecommendations } from '@/lib/queries'
import { consensus, hasCoverage, upside } from '@/lib/analysts'
import { formatPct } from '@/lib/compare'
import { formatPrice } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyTicker } from '@/features/empty-ticker'
import { RecommendationBars } from '@/features/analysts/recommendation-bars'
import { SymbolField } from './settings-fields'
import type { WidgetProps, WidgetSettingsProps } from './registry'

export function AnalystWidget({ config, activeTicker }: WidgetProps<'analyst'>) {
  const symbol = config.symbol ?? activeTicker
  const { data, isPending, isError, error } = useRecommendations(symbol)
  const quote = useQuote(symbol)
  if (!symbol) return <EmptyTicker hint="Pick a symbol in the header, or set one in this widget's settings." />
  if (isPending) return <Skeleton className="h-full w-full rounded-none" aria-busy aria-label="Loading analyst data" />
  if (isError) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {error instanceof ApiError && error.isNotFound ? `No data for ${symbol}.` : error.message}
      </p>
    )
  }
  if (!hasCoverage(data)) return <p className="p-4 text-sm text-muted-foreground">No analyst coverage for {symbol}.</p>
  const c = consensus(data.summary[0])
  const current = quote.data?.price ?? data.price_targets.current ?? null
  const delta = upside(current, data.price_targets.mean)
  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {c ? (
          <span className="flex items-center gap-2">
            <Badge variant="secondary">{c.label}</Badge>
            <span className="text-xs text-muted-foreground tabular-nums">
              {c.score.toFixed(1)} / 5 · {c.analysts} analysts
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">No ratings</span>
        )}
        <span className="tabular-nums">
          Mean target {formatPrice(data.price_targets.mean)}
          {delta != null && <span className={delta >= 0 ? 'ml-1 text-xs text-emerald-500' : 'ml-1 text-xs text-red-500'}>{formatPct(delta, 1)}</span>}
        </span>
      </div>
      <RecommendationBars summary={data.summary} />
    </div>
  )
}

export function AnalystWidgetSettings({ config, onChange }: WidgetSettingsProps<'analyst'>) {
  return <SymbolField id="analyst-symbol" value={config.symbol} onChange={(symbol) => onChange({ symbol })} />
}
