import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AppProviders } from '@/app/providers'
import { makeTestQueryClient } from '@/test/render'
import { seedUser, signInAs, state } from '@/test/supabase-mock'
import { useDashboardStore } from '@/stores/dashboard'
import { addWidget, removeWidget, starterLayout } from './dashboard-layout'
import { SAVE_DEBOUNCE_MS, useDashboard } from './use-dashboard'

function wrapper({ children }: { children: ReactNode }) {
  return <AppProviders queryClient={makeTestQueryClient()}>{children}</AppProviders>
}

beforeEach(() => {
  localStorage.clear()
  useDashboardStore.getState().reset()
})

describe('useDashboard (signed out)', () => {
  it('starts with one default starter layout', () => {
    const { result } = renderHook(() => useDashboard(), { wrapper })
    expect(result.current.source).toBe('local')
    expect(result.current.layouts).toHaveLength(1)
    expect(result.current.active?.isDefault).toBe(true)
    expect(result.current.active?.layout.widgets).toHaveLength(4)
  })

  it('applies edits immediately but persists once after the debounce', () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useDashboard(), { wrapper })
      const id = result.current.active!.id
      act(() => result.current.update(addWidget(result.current.active!.layout, 'compare')))
      act(() => result.current.update(addWidget(result.current.active!.layout, 'quote')))
      expect(result.current.active!.layout.widgets).toHaveLength(6)
      expect(result.current.isSaving).toBe(true)
      expect(useDashboardStore.getState().layouts.find((l) => l.id === id)!.layout.widgets).toHaveLength(4)

      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 10)
      })
      expect(useDashboardStore.getState().layouts.find((l) => l.id === id)!.layout.widgets).toHaveLength(4)
      act(() => {
        vi.advanceTimersByTime(20)
      })
      expect(useDashboardStore.getState().layouts.find((l) => l.id === id)!.layout.widgets).toHaveLength(6)
    } finally {
      vi.useRealTimers()
    }
  })

  it('flush persists pending edits right away', () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useDashboard(), { wrapper })
      const id = result.current.active!.id
      act(() => result.current.update(removeWidget(result.current.active!.layout, 'starter-quote')))
      act(() => result.current.flush())
      expect(useDashboardStore.getState().layouts.find((l) => l.id === id)!.layout.widgets).toHaveLength(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('create, select, rename, setDefault and remove', () => {
    const { result } = renderHook(() => useDashboard(), { wrapper })
    const firstId = result.current.active!.id
    act(() => result.current.create('Trading'))
    expect(result.current.layouts).toHaveLength(2)
    expect(result.current.active?.name).toBe('Trading')
    expect(result.current.active?.isDefault).toBe(false)

    act(() => result.current.rename(result.current.active!.id, 'Swing'))
    expect(result.current.active?.name).toBe('Swing')

    act(() => result.current.setDefault(result.current.active!.id))
    expect(result.current.layouts.find((l) => l.id === firstId)?.isDefault).toBe(false)
    expect(result.current.active?.isDefault).toBe(true)

    act(() => result.current.select(firstId))
    expect(result.current.active?.id).toBe(firstId)

    act(() => result.current.remove(firstId))
    expect(result.current.layouts).toHaveLength(1)
    expect(result.current.active?.name).toBe('Swing')
  })
})

describe('useDashboard (signed in)', () => {
  it('seeds a new account with the local active layout, then saves edits to Supabase', async () => {
    const local = useDashboardStore.getState()
    const customised = removeWidget(starterLayout(), 'starter-analyst')
    local.upsert({ ...local.layouts[0]!, name: 'Mine', layout: customised })
    const { id } = seedUser('a@example.com')
    signInAs('a@example.com')

    const { result } = renderHook(() => useDashboard(), { wrapper })
    await waitFor(() => expect(result.current.source).toBe('cloud'))
    await waitFor(() => expect(result.current.active?.name).toBe('Mine'))
    expect(result.current.active?.layout.widgets).toHaveLength(3)
    expect(state.tables.dashboard_layouts!.filter((r) => r.user_id === id)).toHaveLength(1)
    expect(state.tables.dashboard_layouts![0]).toMatchObject({ is_default: true, name: 'Mine' })

    act(() => result.current.update(addWidget(result.current.active!.layout, 'compare')))
    act(() => result.current.flush())
    await waitFor(() => expect((state.tables.dashboard_layouts![0]!.layout as { widgets: unknown[] }).widgets).toHaveLength(4))
  })

  it('loads existing rows, remembers the selection per user, and deletes', async () => {
    const { id } = seedUser('a@example.com')
    state.tables.dashboard_layouts!.push(
      { id: 'L1', user_id: id, name: 'One', layout: starterLayout(), is_default: true, updated_at: '2026-01-01' },
      { id: 'L2', user_id: id, name: 'Two', layout: starterLayout(), is_default: false, updated_at: '2026-01-02' },
    )
    signInAs('a@example.com')
    const { result } = renderHook(() => useDashboard(), { wrapper })
    await waitFor(() => expect(result.current.layouts).toHaveLength(2))
    expect(result.current.active?.id).toBe('L1')

    act(() => result.current.select('L2'))
    expect(result.current.active?.id).toBe('L2')
    expect(localStorage.getItem(`stock-tool.dashboard.active:${id}`)).toBe('L2')

    act(() => result.current.setDefault('L2'))
    await waitFor(() => expect(state.tables.dashboard_layouts!.find((r) => r.id === 'L2')?.is_default).toBe(true))
    expect(state.tables.dashboard_layouts!.find((r) => r.id === 'L1')?.is_default).toBe(false)

    act(() => result.current.remove('L2'))
    await waitFor(() => expect(result.current.layouts).toHaveLength(1))
    expect(result.current.active?.id).toBe('L1')
  })
})
