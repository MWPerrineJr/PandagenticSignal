import { Button } from '@/components/ui/button'
import { OVERLAY_IDS, OVERLAY_LABELS, type OverlayId } from '@/lib/chart-data'
import {
  CHART_INTERVALS,
  CHART_PERIODS,
  INTERVAL_LABELS,
  PERIOD_LABELS,
  type ChartInterval,
  type ChartPeriod,
} from '@/lib/use-chart-params'
import { CHART_PALETTES } from '@/lib/chart-theme'
import { useTheme } from '@/components/theme-provider'
import { emaSpanOf } from '@/lib/chart-data'
import { cn } from '@/lib/utils'

export interface ChartControlsProps {
  period: ChartPeriod
  interval: ChartInterval
  overlays: Set<OverlayId>
  onPeriod: (p: ChartPeriod) => void
  onInterval: (i: ChartInterval) => void
  onToggleOverlay: (id: OverlayId) => void
  /** Compare mode hides overlays; keep the state but grey the buttons. */
  overlaysDisabled?: boolean
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

export function ChartControls({
  period,
  interval,
  overlays,
  onPeriod,
  onInterval,
  onToggleOverlay,
  overlaysDisabled = false,
}: ChartControlsProps) {
  const { theme } = useTheme()
  const palette = CHART_PALETTES[theme]
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented label="Period" options={CHART_PERIODS} value={period} labels={PERIOD_LABELS} onChange={onPeriod} />
      <Segmented label="Interval" options={CHART_INTERVALS} value={interval} labels={INTERVAL_LABELS} onChange={onInterval} />
      <div role="group" aria-label="Overlays" className={cn('flex flex-wrap gap-1', overlaysDisabled && 'opacity-50')}>
        {OVERLAY_IDS.map((id) => {
          const on = overlays.has(id)
          const span = emaSpanOf(id)
          const color = span ? palette.ema[span] : id === 'bb' ? palette.bollinger : palette.resistance
          return (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={on ? 'secondary' : 'ghost'}
              aria-pressed={on}
              disabled={overlaysDisabled}
              onClick={() => onToggleOverlay(id)}
              className={cn('h-7 gap-1.5 text-xs', !on && 'text-muted-foreground')}
            >
              <span className="inline-block size-2 rounded-full" style={{ background: color, opacity: on ? 1 : 0.4 }} aria-hidden />
              {OVERLAY_LABELS[id]}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
