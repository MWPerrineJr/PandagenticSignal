import { useRef, type FormEvent } from 'react'
import { PlayIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface SimulationParams {
  horizon_years: number
  n_sims: number
  initial_value: number
  monthly_contribution: number
}

export const DEFAULT_SIM_PARAMS: SimulationParams = { horizon_years: 10, n_sims: 2000, initial_value: 10_000, monthly_contribution: 0 }

const LIMITS: Record<keyof SimulationParams, [number, number]> = {
  horizon_years: [1, 40],
  n_sims: [100, 10_000],
  initial_value: [1, 1e9],
  monthly_contribution: [0, 1e7],
}

/** Read and clamp the fields; blank or junk falls back to the default. */
export function readParams(form: FormData): SimulationParams {
  const out = { ...DEFAULT_SIM_PARAMS }
  for (const key of Object.keys(LIMITS) as Array<keyof SimulationParams>) {
    const raw = Number(form.get(key))
    const [lo, hi] = LIMITS[key]
    if (form.get(key) !== '' && Number.isFinite(raw)) out[key] = Math.min(hi, Math.max(lo, raw))
  }
  out.horizon_years = Math.round(out.horizon_years)
  out.n_sims = Math.round(out.n_sims)
  return out
}

const field = 'h-8 w-28 rounded-md border bg-background px-2 text-sm tabular-nums'

export function SimulationControls({ onRun, running, disabled }: { onRun: (p: SimulationParams) => void; running: boolean; disabled?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null)
  const run = () => formRef.current && onRun(readParams(new FormData(formRef.current)))
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault() // Enter in a field
    run()
  }
  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3 text-sm" aria-label="Simulation settings">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Horizon (years)</span>
        <input name="horizon_years" type="number" min={1} max={40} defaultValue={DEFAULT_SIM_PARAMS.horizon_years} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Initial value ($)</span>
        <input name="initial_value" type="number" min={1} step={1000} defaultValue={DEFAULT_SIM_PARAMS.initial_value} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Monthly contribution ($)</span>
        <input name="monthly_contribution" type="number" min={0} step={50} defaultValue={DEFAULT_SIM_PARAMS.monthly_contribution} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Simulations</span>
        <input name="n_sims" type="number" min={100} max={10000} step={100} defaultValue={DEFAULT_SIM_PARAMS.n_sims} className={field} />
      </label>
      <Button type="button" size="sm" disabled={running || disabled} onClick={run}>
        <PlayIcon /> {running ? 'Simulating…' : 'Run simulation'}
      </Button>
    </form>
  )
}
