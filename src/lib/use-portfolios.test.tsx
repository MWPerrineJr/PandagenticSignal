import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AppProviders } from '@/app/providers'
import { makeTestQueryClient } from '@/test/render'
import { seedPortfolio, seedUser, signInAs, state } from '@/test/supabase-mock'
import { usePortfolioStore } from '@/stores/portfolios'
import { SAVE_DEBOUNCE_MS, usePortfolios } from './use-portfolios'

function wrapper({ children }: { children: ReactNode }) {
  return <AppProviders queryClient={makeTestQueryClient()}>{children}</AppProviders>
}

const AAPL = { symbol: 'AAPL', value: 60 }
const BTC = { symbol: 'BTC-USD', value: 40 }

beforeEach(() => {
  localStorage.clear()
  usePortfolioStore.getState().reset()
})

describe('usePortfolios (signed out)', () => {
  it('starts with an empty starter portfolio', () => {
    const { result } = renderHook(() => usePortfolios(), { wrapper })
    expect(result.current.source).toBe('local')
    expect(result.current.portfolios).toHaveLength(1)
    expect(result.current.active?.holdings).toEqual([])
  })

  it('applies edits immediately and persists after the debounce', () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => usePortfolios(), { wrapper })
      const id = result.current.active!.id
      act(() => result.current.update([AAPL], 'weight'))
      act(() => result.current.update([AAPL, BTC], 'weight'))
      expect(result.current.active!.holdings).toHaveLength(2)
      expect(result.current.isSaving).toBe(true)
      expect(usePortfolioStore.getState().portfolios.find((p) => p.id === id)!.holdings).toHaveLength(0)
      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 5)
      })
      expect(usePortfolioStore.getState().portfolios.find((p) => p.id === id)!.holdings).toHaveLength(2)
      // Same holdings again is a no-op; a mode switch is an edit.
      act(() => result.current.update([BTC, AAPL], 'weight'))
      expect(result.current.isSaving).toBe(false)
      act(() => result.current.update([AAPL, BTC], 'amount'))
      act(() => result.current.flush())
      expect(usePortfolioStore.getState().portfolios.find((p) => p.id === id)!.mode).toBe('amount')
    } finally {
      vi.useRealTimers()
    }
  })

  it('create, select, rename and remove', () => {
    const { result } = renderHook(() => usePortfolios(), { wrapper })
    const firstId = result.current.active!.id
    act(() => result.current.create('Crypto only', [BTC]))
    expect(result.current.portfolios).toHaveLength(2)
    expect(result.current.active?.name).toBe('Crypto only')
    expect(result.current.active?.holdings).toEqual([BTC])
    act(() => result.current.rename(result.current.active!.id, 'Coins'))
    expect(result.current.active?.name).toBe('Coins')
    act(() => result.current.select(firstId))
    expect(result.current.active?.id).toBe(firstId)
    act(() => result.current.remove(firstId))
    expect(result.current.portfolios).toHaveLength(1)
    expect(result.current.active?.name).toBe('Coins')
  })
})

describe('usePortfolios (signed in)', () => {
  it('seeds a new account with the local active portfolio, then saves edits to Supabase', async () => {
    const local = usePortfolioStore.getState()
    local.upsert({ ...local.portfolios[0]!, name: 'Mine', holdings: [AAPL] })
    const { id } = seedUser('a@example.com')
    signInAs('a@example.com')

    const { result } = renderHook(() => usePortfolios(), { wrapper })
    await waitFor(() => expect(result.current.source).toBe('cloud'))
    await waitFor(() => expect(result.current.active?.name).toBe('Mine'))
    expect(result.current.active?.holdings).toEqual([AAPL])
    expect(state.tables.portfolios!.filter((r) => r.user_id === id)).toHaveLength(1)

    act(() => result.current.update([AAPL, BTC], 'weight'))
    act(() => result.current.flush())
    await waitFor(() => expect((state.tables.portfolios![0]!.holdings as unknown[]).length).toBe(2))
    expect(state.tables.portfolios![0]!.holdings).toEqual([
      { symbol: 'AAPL', weight: 60 },
      { symbol: 'BTC-USD', weight: 40 },
    ])
  })

  it('loads existing rows, remembers the selection per user, and deletes', async () => {
    const { id } = seedUser('a@example.com')
    seedPortfolio(id, { id: 'P1', name: 'One', holdings: [{ symbol: 'AAPL', weight: 1 }], updated_at: '2026-01-02' })
    seedPortfolio(id, { id: 'P2', name: 'Two', holdings: [{ symbol: 'MSFT', amount: 5 }], updated_at: '2026-01-01' })
    signInAs('a@example.com')
    const { result } = renderHook(() => usePortfolios(), { wrapper })
    await waitFor(() => expect(result.current.portfolios).toHaveLength(2))
    expect(result.current.active?.id).toBe('P1')

    act(() => result.current.select('P2'))
    expect(result.current.active?.mode).toBe('amount')
    expect(localStorage.getItem(`stock-tool.portfolios.active:${id}`)).toBe('P2')

    act(() => result.current.remove('P2'))
    await waitFor(() => expect(result.current.portfolios).toHaveLength(1))
    expect(result.current.active?.id).toBe('P1')
  })
})
