import { ApiError } from '@/lib/api'
import { useIndicatorCatalog, useIndicators } from '@/lib/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { IndicatorPicker } from '@/features/charts/indicator-picker'
import { PriceChart } from '@/features/charts/price-chart'
import { EmptyTicker } from '@/features/empty-ticker'
import { IntervalField, PeriodField, SymbolField } from './settings-fields'
import type { WidgetProps, WidgetSettingsProps } from './registry'

export function ChartWidget({ config, activeTicker }: WidgetProps<'chart'>) {
  const symbol = config.symbol ?? activeTicker
  const { data, isPending, isError, error } = useIndicators(symbol, config.period, config.interval, config.indicators)
  if (!symbol) return <EmptyTicker hint="Pick a symbol in the header, or set one in this widget's settings." />
  if (isPending) return <Skeleton className="h-full w-full rounded-none" aria-busy aria-label="Loading chart" />
  if (isError) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {error instanceof ApiError && error.isNotFound ? `No price history for ${symbol}.` : error.message}
      </p>
    )
  }
  return <PriceChart data={data} height="100%" />
}

export function ChartWidgetSettings({ config, onChange }: WidgetSettingsProps<'chart'>) {
  const catalog = useIndicatorCatalog()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SymbolField id="chart-symbol" value={config.symbol} onChange={(symbol) => onChange({ symbol })} />
        <PeriodField value={config.period} onChange={(period) => onChange({ period })} />
        <IntervalField value={config.interval} onChange={(interval) => onChange({ interval })} />
      </div>
      <IndicatorPicker inline catalog={catalog.data} tokens={config.indicators} onChange={(indicators) => onChange({ indicators })} />
    </div>
  )
}
