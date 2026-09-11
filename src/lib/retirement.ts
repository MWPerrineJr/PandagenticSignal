/**
 * Retirement inputs and a TypeScript twin of the API's deterministic projection, so sliders
 * update the nest-egg chart instantly. Parity with `api/app/services/retirement.py` is pinned
 * by `src/test/fixtures/retirement-parity.json` (generated from the Python function).
 */
import { z } from 'zod'

export const MAX_AGE = 110

export const retirementInputsSchema = z
  .object({
    current_age: z.number().int().min(0).max(MAX_AGE).default(35),
    retirement_age: z.number().int().min(1).max(MAX_AGE).default(65),
    life_expectancy: z.number().int().min(2).max(MAX_AGE).default(90),
    current_savings: z.number().min(0).default(50_000),
    monthly_contribution: z.number().min(0).default(1_000),
    expected_return: z.number().min(-0.5).max(0.5).default(0.06),
    inflation: z.number().min(-0.5).max(0.5).default(0.025),
    annual_spending: z.number().min(0).default(50_000),
    volatility: z.number().min(0).max(1).default(0.12),
  })
  .refine((v) => v.current_age < v.retirement_age && v.retirement_age < v.life_expectancy, {
    message: 'Ages must increase: current < retirement < life expectancy',
  })
export type RetirementInputs = z.infer<typeof retirementInputsSchema>

export const DEFAULT_RETIREMENT_INPUTS: RetirementInputs = retirementInputsSchema.parse({})

/** Field limits used by the sliders. */
export const RETIREMENT_LIMITS = {
  current_age: { min: 18, max: 80, step: 1 },
  retirement_age: { min: 30, max: 90, step: 1 },
  life_expectancy: { min: 60, max: 110, step: 1 },
  current_savings: { min: 0, max: 5_000_000, step: 5_000 },
  monthly_contribution: { min: 0, max: 20_000, step: 100 },
  expected_return: { min: -0.1, max: 0.15, step: 0.005 },
  inflation: { min: 0, max: 0.1, step: 0.005 },
  annual_spending: { min: 0, max: 500_000, step: 1_000 },
  volatility: { min: 0, max: 0.4, step: 0.01 },
} as const

export interface YearPoint {
  age: number
  year: number
  balance_nominal: number
  balance_real: number
  cashflow: number
}

export const agesValid = (v: Pick<RetirementInputs, 'current_age' | 'retirement_age' | 'life_expectancy'>) =>
  v.current_age < v.retirement_age && v.retirement_age < v.life_expectancy

/** Nominal cashflow for year index t (0-based): contributions while working, inflated spending after. */
export function cashflow(inputs: RetirementInputs, t: number): number {
  const age = inputs.current_age + t
  return age < inputs.retirement_age ? 12 * inputs.monthly_contribution : -inputs.annual_spending * (1 + inputs.inflation) ** (t + 1)
}

/** Balance at each birthday from now to life expectancy at a fixed annual return (floored at 0). */
export function projectDeterministic(inputs: RetirementInputs, expectedReturn = inputs.expected_return): YearPoint[] {
  if (!agesValid(inputs)) return []
  const years = inputs.life_expectancy - inputs.current_age
  let balance = inputs.current_savings
  const points: YearPoint[] = [{ age: inputs.current_age, year: 0, balance_nominal: balance, balance_real: balance, cashflow: 0 }]
  for (let t = 1; t <= years; t++) {
    const cf = cashflow(inputs, t - 1)
    balance = Math.max(0, balance * (1 + expectedReturn) + cf)
    points.push({ age: inputs.current_age + t, year: t, balance_nominal: balance, balance_real: balance / (1 + inputs.inflation) ** t, cashflow: cf })
  }
  return points
}

/** First age at or after retirement where the deterministic balance hits zero, if any. */
export function depletionAge(points: YearPoint[], retirementAge: number): number | null {
  const hit = points.find((p) => p.age >= retirementAge && p.balance_nominal <= 0)
  return hit ? hit.age : null
}
