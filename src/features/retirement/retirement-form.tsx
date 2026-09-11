import { RETIREMENT_LIMITS, type RetirementInputs } from '@/lib/retirement'
import type { Portfolio } from '@/lib/portfolio'
import type { AssumptionSource } from '@/stores/retirement'
import { formatPercent, formatPrice } from '@/lib/format'

type NumericKey = keyof typeof RETIREMENT_LIMITS

interface FieldDef {
  key: NumericKey
  label: string
  format: (v: number) => string
  /** Multiplier between the displayed number and the stored value (rates are stored as fractions). */
  scale?: number
}

const AGES: FieldDef[] = [
  { key: 'current_age', label: 'Current age', format: (v) => `${v}` },
  { key: 'retirement_age', label: 'Retirement age', format: (v) => `${v}` },
  { key: 'life_expectancy', label: 'Plan to age', format: (v) => `${v}` },
]
const MONEY: FieldDef[] = [
  { key: 'current_savings', label: 'Current savings', format: (v) => formatPrice(v) },
  { key: 'monthly_contribution', label: 'Monthly contribution', format: (v) => formatPrice(v) },
  { key: 'annual_spending', label: 'Annual spending in retirement (today’s $)', format: (v) => formatPrice(v) },
]
const RATES: FieldDef[] = [
  { key: 'expected_return', label: 'Expected annual return', format: (v) => formatPercent(v), scale: 100 },
  { key: 'inflation', label: 'Inflation', format: (v) => formatPercent(v), scale: 100 },
  { key: 'volatility', label: 'Volatility (annual)', format: (v) => formatPercent(v, 0), scale: 100 },
]

export interface RetirementFormProps {
  inputs: RetirementInputs
  onChange: (patch: Partial<RetirementInputs>) => void
  source: AssumptionSource
  onSource: (source: AssumptionSource) => void
  portfolios: Portfolio[]
  /** Assumptions derived from the chosen portfolio, once known. */
  derived?: { mu: number; sigma: number; symbols: string[] } | null
}

export function RetirementForm({ inputs, onChange, source, onSource, portfolios, derived }: RetirementFormProps) {
  const parametric = source.kind === 'parametric'
  const field = (f: FieldDef, disabled = false) => {
    const lim = RETIREMENT_LIMITS[f.key]
    const scale = f.scale ?? 1
    const value = inputs[f.key]
    const set = (raw: string) => {
      const n = Number(raw) / scale
      if (Number.isFinite(n)) onChange({ [f.key]: n })
    }
    return (
      <div key={f.key} className="space-y-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <label htmlFor={`rt-${f.key}`}>{f.label}</label>
          <span className="tabular-nums text-muted-foreground">{f.format(value)}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            id={`rt-${f.key}`}
            type="range"
            min={lim.min * scale}
            max={lim.max * scale}
            step={lim.step * scale}
            value={value * scale}
            onChange={(e) => set(e.target.value)}
            disabled={disabled}
            className="w-full accent-primary"
            aria-label={f.label}
          />
          <input
            type="number"
            min={lim.min * scale}
            max={lim.max * scale}
            step={lim.step * scale}
            value={Math.round(value * scale * 1000) / 1000}
            onChange={(e) => set(e.target.value)}
            disabled={disabled}
            className="h-7 w-24 rounded-md border bg-background px-2 text-right text-xs tabular-nums"
            aria-label={`${f.label} (number)`}
          />
        </div>
      </div>
    )
  }

  return (
    <form className="grid gap-6 md:grid-cols-3" aria-label="Retirement inputs" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Timeline</legend>
        {AGES.map((f) => field(f))}
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Money</legend>
        {MONEY.map((f) => field(f))}
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Assumptions</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span>Return and volatility from</span>
          <select
            aria-label="Assumptions source"
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={parametric ? '' : source.portfolioId}
            onChange={(e) => onSource(e.target.value ? { kind: 'portfolio', portfolioId: e.target.value } : { kind: 'parametric' })}
          >
            <option value="">Your own numbers</option>
            {portfolios
              .filter((p) => p.holdings.length > 0)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  Portfolio “{p.name}”
                </option>
              ))}
          </select>
        </label>
        {!parametric && (
          <p className="text-xs text-muted-foreground" data-testid="derived-assumptions">
            {derived
              ? `From ${derived.symbols.join(', ')}: ${formatPercent(derived.mu)} expected return, ${formatPercent(derived.sigma, 0)} volatility (run Monte Carlo to refresh).`
              : 'Run Monte Carlo to derive the return and volatility from this portfolio’s history.'}
          </p>
        )}
        {RATES.map((f) => field(f, !parametric && f.key !== 'inflation'))}
      </fieldset>
    </form>
  )
}
