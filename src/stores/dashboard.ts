import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newId, parseLayout, starterLayout, type DashboardLayout, type NamedLayout } from '@/lib/dashboard-layout'

interface DashboardState {
  layouts: NamedLayout[]
  activeId: string | null
  upsert: (named: Omit<NamedLayout, 'updatedAt'> & { updatedAt?: string }) => void
  remove: (id: string) => void
  setActive: (id: string) => void
  setDefault: (id: string) => void
  reset: () => void
}

export function makeNamed(name: string, layout: DashboardLayout = starterLayout(), isDefault = false): NamedLayout {
  return { id: newId(), name, isDefault, layout, updatedAt: new Date().toISOString() }
}

function seed(): Pick<DashboardState, 'layouts' | 'activeId'> {
  const first = makeNamed('My dashboard', starterLayout(), true)
  return { layouts: [first], activeId: first.id }
}

/** Signed-out dashboards, persisted in this browser. */
export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      ...seed(),
      upsert: (named) => {
        const updatedAt = named.updatedAt ?? new Date().toISOString()
        const exists = get().layouts.some((l) => l.id === named.id)
        const layouts = exists
          ? get().layouts.map((l) => (l.id === named.id ? { ...l, ...named, updatedAt } : l))
          : [...get().layouts, { ...named, updatedAt }]
        set({ layouts, activeId: get().activeId ?? named.id })
      },
      remove: (id) => {
        const layouts = get().layouts.filter((l) => l.id !== id)
        const next = layouts.length ? layouts : seed().layouts
        const activeId = get().activeId === id ? (next.find((l) => l.isDefault) ?? next[0]!).id : get().activeId
        set({ layouts: next, activeId })
      },
      setActive: (id) => set({ activeId: id }),
      setDefault: (id) => set({ layouts: get().layouts.map((l) => ({ ...l, isDefault: l.id === id })) }),
      reset: () => set(seed()),
    }),
    {
      name: 'stock-tool.dashboard',
      version: 1,
      merge: (persisted, current) => {
        // Re-validate stored layouts so a bad entry falls back to the starter instead of crashing.
        const p = (persisted ?? {}) as Partial<DashboardState>
        const layouts = (p.layouts ?? [])
          .map((l) => {
            try {
              return { ...l, layout: parseLayout(l.layout) }
            } catch {
              return { ...l, layout: starterLayout() }
            }
          })
          .filter((l) => l.id && l.name)
        if (layouts.length === 0) return { ...current, ...seed() }
        const activeId = layouts.some((l) => l.id === p.activeId) ? p.activeId! : (layouts.find((l) => l.isDefault) ?? layouts[0]!).id
        return { ...current, layouts, activeId }
      },
    },
  ),
)
