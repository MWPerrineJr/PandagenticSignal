import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AppProviders } from '@/app/providers'
import { makeTestQueryClient } from '@/test/render'
import { seedUser, signInAs, state } from '@/test/supabase-mock'
import { useIndicatorStore } from '@/stores/indicators'
import { DEFAULT_TOKENS } from './indicators'
import { SAVE_DEBOUNCE_MS, useIndicatorSelection } from './use-indicator-selection'

function wrapper({ children }: { children: ReactNode }) {
  return <AppProviders queryClient={makeTestQueryClient()}>{children}</AppProviders>
}

beforeEach(() => {
  localStorage.clear()
  useIndicatorStore.getState().reset()
})

describe('useIndicatorSelection (signed out)', () => {
  it('starts with the defaults and writes to the local store at once', () => {
    const { result } = renderHook(() => useIndicatorSelection(), { wrapper })
    expect(result.current.source).toBe('local')
    expect(result.current.tokens).toEqual([...DEFAULT_TOKENS])
    act(() => result.current.setTokens(['rsi:14', 'rsi:14', 'sma:50']))
    expect(result.current.tokens).toEqual(['rsi:14', 'sma:50'])
    expect(useIndicatorStore.getState().tokens).toEqual(['rsi:14', 'sma:50'])
    act(() => result.current.reset())
    expect(result.current.tokens).toEqual([...DEFAULT_TOKENS])
  })

  it('rejects unreadable input by falling back to the defaults', () => {
    const { result } = renderHook(() => useIndicatorSelection(), { wrapper })
    act(() => result.current.setTokens(['sma:50']))
    act(() => result.current.setTokens(['not a token']))
    expect(result.current.tokens).toEqual([...DEFAULT_TOKENS])
  })
})

describe('useIndicatorSelection (signed in)', () => {
  it('seeds a new account from the local selection, then saves edits after the debounce', async () => {
    useIndicatorStore.getState().setTokens(['macd:12-26-9', 'sr'])
    const { id } = seedUser('a@example.com')
    signInAs('a@example.com')
    const { result } = renderHook(() => useIndicatorSelection(), { wrapper })
    await waitFor(() => expect(result.current.source).toBe('cloud'))
    await waitFor(() => expect(result.current.tokens).toEqual(['macd:12-26-9', 'sr']))
    expect(state.tables.indicator_settings).toEqual([expect.objectContaining({ user_id: id, tokens: ['macd:12-26-9', 'sr'] })])

    vi.useFakeTimers()
    try {
      act(() => result.current.setTokens(['rsi:14']))
      expect(result.current.tokens).toEqual(['rsi:14'])
      expect(state.tables.indicator_settings![0]!.tokens).toEqual(['macd:12-26-9', 'sr'])
      await act(async () => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 5)
      })
      expect(state.tables.indicator_settings![0]!.tokens).toEqual(['rsi:14'])
      expect(state.tables.indicator_settings).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reads an existing account row instead of the local store', async () => {
    useIndicatorStore.getState().setTokens(['obv'])
    const { id } = seedUser('b@example.com')
    state.tables.indicator_settings!.push({ user_id: id, tokens: ['adx:14', 'atr:14'], updated_at: '2026-01-01T00:00:00Z' })
    signInAs('b@example.com')
    const { result } = renderHook(() => useIndicatorSelection(), { wrapper })
    await waitFor(() => expect(result.current.tokens).toEqual(['adx:14', 'atr:14']))
    expect(useIndicatorStore.getState().tokens).toEqual(['obv'])
  })
})
