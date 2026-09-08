import { Input } from '@/components/ui/input'
import { CHART_INTERVALS, CHART_PERIODS, INTERVAL_LABELS, PERIOD_LABELS, type ChartInterval, type ChartPeriod } from '@/lib/use-chart-params'
import { normaliseSymbol } from '@/lib/api'

const selectClass = 'h-7 rounded-md border bg-background px-2 text-xs'

/** Symbol field: blank = follow the header ticker. */
export function SymbolField({ id, value, onChange }: { id: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-16 text-muted-foreground">Symbol</span>
      <Input
        id={id}
        className="h-7 w-28 font-mono text-xs uppercase"
        placeholder="follows header"
        value={value ?? ''}
        onChange={(e) => onChange(normaliseSymbol(e.target.value) || null)}
        aria-label="Symbol (blank follows the header ticker)"
      />
    </label>
  )
}

export function PeriodField({ value, onChange }: { value: ChartPeriod; onChange: (v: ChartPeriod) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-16 text-muted-foreground">Period</span>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value as ChartPeriod)} aria-label="Period">
        {CHART_PERIODS.map((p) => (
          <option key={p} value={p}>
            {PERIOD_LABELS[p]}
          </option>
        ))}
      </select>
    </label>
  )
}

export function IntervalField({ value, onChange }: { value: ChartInterval; onChange: (v: ChartInterval) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-16 text-muted-foreground">Interval</span>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value as ChartInterval)} aria-label="Interval">
        {CHART_INTERVALS.map((i) => (
          <option key={i} value={i}>
            {INTERVAL_LABELS[i]}
          </option>
        ))}
      </select>
    </label>
  )
}
