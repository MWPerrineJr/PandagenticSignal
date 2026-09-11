import parity from '@/test/fixtures/retirement-parity.json'
import { DEFAULT_RETIREMENT_INPUTS, cashflow, depletionAge, projectDeterministic, retirementInputsSchema, type RetirementInputs } from './retirement'

type Case = { inputs: Omit<RetirementInputs, 'volatility'>; points: ReturnType<typeof projectDeterministic> }

describe('retirement projection', () => {
  it('matches the Python engine on the committed parity fixture', () => {
    for (const c of parity as Case[]) {
      const points = projectDeterministic({ ...c.inputs, volatility: 0.12 })
      expect(points).toHaveLength(c.points.length)
      points.forEach((p, i) => {
        const q = c.points[i]!
        expect(p.age).toBe(q.age)
        expect(p.year).toBe(q.year)
        expect(p.cashflow).toBeCloseTo(q.cashflow, 6)
        expect(p.balance_nominal).toBeCloseTo(q.balance_nominal, 4)
        expect(p.balance_real).toBeCloseTo(q.balance_real, 4)
      })
    }
  })

  it('contributes until retirement, then withdraws inflated spending', () => {
    const inputs = { ...DEFAULT_RETIREMENT_INPUTS, current_age: 40, retirement_age: 45, life_expectancy: 50, inflation: 0.1, monthly_contribution: 1000, annual_spending: 20_000 }
    expect(cashflow(inputs, 0)).toBe(12_000)
    expect(cashflow(inputs, 4)).toBe(12_000)
    expect(cashflow(inputs, 5)).toBeCloseTo(-20_000 * 1.1 ** 6)
    const points = projectDeterministic({ ...inputs, expected_return: 0, inflation: 0 })
    expect(points[5]!.balance_nominal).toBe(50_000 + 60_000)
    expect(points[10]!.balance_nominal).toBe(110_000 - 5 * 20_000)
    expect(depletionAge(points, 45)).toBeNull()
    const broke = projectDeterministic({ ...inputs, expected_return: 0, inflation: 0, annual_spending: 200_000 })
    expect(depletionAge(broke, 45)).toBe(46)
    expect(Math.min(...broke.map((p) => p.balance_nominal))).toBe(0)
  })

  it('returns nothing for misordered ages and validates defaults', () => {
    expect(projectDeterministic({ ...DEFAULT_RETIREMENT_INPUTS, retirement_age: 30 })).toEqual([])
    expect(retirementInputsSchema.safeParse({}).success).toBe(true)
    expect(retirementInputsSchema.safeParse({ current_age: 70, retirement_age: 65 }).success).toBe(false)
    expect(retirementInputsSchema.safeParse({ expected_return: 0.9 }).success).toBe(false)
  })
})
