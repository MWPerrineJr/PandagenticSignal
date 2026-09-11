import {
  CHART_INTERVALS,
  CHART_PERIODS,
  INTERVAL_LABELS,
  PERIOD_LABELS,
  type ChartInterval,
  type ChartPeriod,
} from '@/lib/use-chart-params'
import { cn } from '@/lib/utils'

export interface ChartControlsProps {
  period: ChartPeriod
  interval: ChartInterval
  onPeriod: (p: ChartPeriod) => void
  onInterval: (i: ChartInterval) => void
}

function Segmented<T extends string>({
  label,
  options,
  value,
  labels,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  labels: Record<T, string>
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={opt === value}
          onClick={() => onChange(opt)}
          className={cn(
            'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
            opt === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  )
}

export function ChartControls({ period, interval, onPeriod, onInterval }: ChartControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented label="Period" options={CHART_PERIODS} value={period} labels={PERIOD_LABELS} onChange={onPeriod} />
      <Segmented label="Interval" options={CHART_INTERVALS} value={interval} labels={INTERVAL_LABELS} onChange={onInterval} />
    </div>
  )
}
