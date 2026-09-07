import { ApiError } from '@/lib/api'
import { useIndicators } from '@/lib/queries'
import { OVERLAY_IDS, OVERLAY_LABELS, type OverlayId } from '@/lib/chart-data'
import { Skeleton } from '@/components/ui/skeleton'
import { PriceChart } from '@/features/charts/price-chart'
import { EmptyTicker } from '@/features/empty-ticker'
import { IntervalField, PeriodField, SymbolField } from './settings-fields'
import type { WidgetProps, WidgetSettingsProps } from './registry'

export function ChartWidget({ config, activeTicker }: WidgetProps<'chart'>) {
  const symbol = config.symbol ?? activeTicker
  const { data, isPending, isError, error } = useIndicators(symbol, config.period, config.interval)
  if (!symbol) return <EmptyTicker hint="Pick a symbol in the header, or set one in this widget's settings." />
  if (isPending) return <Skeleton className="h-full w-full rounded-none" aria-busy aria-label="Loading chart" />
  if (isError) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {error instanceof ApiError && error.isNotFound ? `No price history for ${symbol}.` : error.message}
      </p>
    )
  }
  return <PriceChart data={data} overlays={new Set(config.overlays)} height="100%" />
}

export function ChartWidgetSettings({ config, onChange }: WidgetSettingsProps<'chart'>) {
  const toggle = (id: OverlayId) => {
    const set = new Set(config.overlays)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onChange({ overlays: OVERLAY_IDS.filter((o) => set.has(o)) })
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <SymbolField id="chart-symbol" value={config.symbol} onChange={(symbol) => onChange({ symbol })} />
      <PeriodField value={config.period} onChange={(period) => onChange({ period })} />
      <IntervalField value={config.interval} onChange={(interval) => onChange({ interval })} />
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Overlays</legend>
        {OVERLAY_IDS.map((id) => (
          <label key={id} className="flex items-center gap-1">
            <input type="checkbox" checked={config.overlays.includes(id)} onChange={() => toggle(id)} />
            {OVERLAY_LABELS[id]}
          </label>
        ))}
      </fieldset>
    </div>
  )
}
