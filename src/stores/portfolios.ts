import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { parsePortfolio, starterPortfolio, type Portfolio } from '@/lib/portfolio'

interface PortfolioState {
  portfolios: Portfolio[]
  activeId: string | null
  upsert: (portfolio: Omit<Portfolio, 'updatedAt'> & { updatedAt?: string }) => void
  remove: (id: string) => void
  setActive: (id: string) => void
  reset: () => void
}

function seed(): Pick<PortfolioState, 'portfolios' | 'activeId'> {
  const first = starterPortfolio()
  return { portfolios: [first], activeId: first.id }
}

/** Signed-out portfolios, persisted in this browser. */
export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      ...seed(),
      upsert: (portfolio) => {
        const updatedAt = portfolio.updatedAt ?? new Date().toISOString()
        const exists = get().portfolios.some((p) => p.id === portfolio.id)
        const portfolios = exists
          ? get().portfolios.map((p) => (p.id === portfolio.id ? { ...p, ...portfolio, updatedAt } : p))
          : [...get().portfolios, { ...portfolio, updatedAt }]
        set({ portfolios, activeId: get().activeId ?? portfolio.id })
      },
      remove: (id) => {
        const portfolios = get().portfolios.filter((p) => p.id !== id)
        const next = portfolios.length ? portfolios : seed().portfolios
        const activeId = get().activeId === id ? next[0]!.id : get().activeId
        set({ portfolios: next, activeId })
      },
      setActive: (id) => set({ activeId: id }),
      reset: () => set(seed()),
    }),
    {
      name: 'stock-tool.portfolios',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PortfolioState>
        const portfolios = (p.portfolios ?? []).flatMap((raw) => {
          try {
            return [parsePortfolio(raw)]
          } catch {
            return []
          }
        })
        if (portfolios.length === 0) return { ...current, ...seed() }
        const activeId = portfolios.some((x) => x.id === p.activeId) ? p.activeId! : portfolios[0]!.id
        return { ...current, portfolios, activeId }
      },
    },
  ),
)
