import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_RETIREMENT_INPUTS, retirementInputsSchema, type RetirementInputs } from '@/lib/retirement'

export type AssumptionSource = { kind: 'parametric' } | { kind: 'portfolio'; portfolioId: string }

interface RetirementState {
  inputs: RetirementInputs
  source: AssumptionSource
  set: (patch: Partial<RetirementInputs>) => void
  setSource: (source: AssumptionSource) => void
  reset: () => void
}

/** Retirement inputs live in this browser only (no account table; they are not sensitive data). */
export const useRetirementStore = create<RetirementState>()(
  persist(
    (set, get) => ({
      inputs: DEFAULT_RETIREMENT_INPUTS,
      source: { kind: 'parametric' },
      set: (patch) => set({ inputs: { ...get().inputs, ...patch } }),
      setSource: (source) => set({ source }),
      reset: () => set({ inputs: DEFAULT_RETIREMENT_INPUTS, source: { kind: 'parametric' } }),
    }),
    {
      name: 'stock-tool.retirement',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RetirementState>
        const parsed = retirementInputsSchema.safeParse({ ...DEFAULT_RETIREMENT_INPUTS, ...(p.inputs ?? {}) })
        const source: AssumptionSource = p.source?.kind === 'portfolio' && p.source.portfolioId ? p.source : { kind: 'parametric' }
        return { ...current, inputs: parsed.success ? parsed.data : DEFAULT_RETIREMENT_INPUTS, source }
      },
    },
  ),
)
