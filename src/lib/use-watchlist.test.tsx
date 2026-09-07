import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AppProviders } from '@/app/providers'
import { makeTestQueryClient } from '@/test/render'
import { seedSymbols, seedUser, signInAs, state, supabase, symbolsFor } from '@/test/supabase-mock'
import { useTickerStore } from '@/stores/tickers'
import { useWatchlist } from './use-watchlist'

function wrapper({ children }: { children: ReactNode }) {
  return <AppProviders queryClient={makeTestQueryClient()}>{children}</AppProviders>
}

beforeEach(() => {
  useTickerStore.getState().clear()
  localStorage.clear()
})

describe('useWatchlist', () => {
  it('signed out: uses the local store', async () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper })
    expect(result.current.source).toBe('local')
    act(() => result.current.add('aapl'))
    expect(result.current.tickers).toEqual(['AAPL'])
    expect(useTickerStore.getState().tickers).toEqual(['AAPL'])
  })

  it('signed in: reads the cloud list and writes through the RPC', async () => {
    const { id } = seedUser('a@example.com')
    seedSymbols(id, ['MSFT'])
    signInAs('a@example.com')
    const { result } = renderHook(() => useWatchlist(), { wrapper })
    await waitFor(() => expect(result.current.source).toBe('cloud'))
    await waitFor(() => expect(result.current.tickers).toEqual(['MSFT']))

    act(() => result.current.add('nvda'))
    await waitFor(() => expect(result.current.tickers).toEqual(['MSFT', 'NVDA'])) // optimistic
    await waitFor(() => expect(symbolsFor(id)).toEqual(['MSFT', 'NVDA']))

    act(() => result.current.move('NVDA', -1))
    await waitFor(() => expect(symbolsFor(id)).toEqual(['NVDA', 'MSFT']))
    act(() => result.current.remove('msft'))
    await waitFor(() => expect(symbolsFor(id)).toEqual(['NVDA']))
    expect(result.current.has('nvda')).toBe(true)
    expect(useTickerStore.getState().tickers).toEqual([]) // local store untouched
  })

  it('rolls back and reports when the save fails', async () => {
    const { id } = seedUser('a@example.com')
    seedSymbols(id, ['MSFT'])
    signInAs('a@example.com')
    const { result } = renderHook(() => useWatchlist(), { wrapper })
    await waitFor(() => expect(result.current.tickers).toEqual(['MSFT']))
    state.failNextRpc = 'row-level security'
    act(() => result.current.add('AAPL'))
    await waitFor(() => expect(result.current.error).toMatch(/row-level security/))
    await waitFor(() => expect(result.current.tickers).toEqual(['MSFT']))
  })

  it('imports a local list into an empty cloud list on first sign-in, once', async () => {
    useTickerStore.getState().add('AAPL')
    useTickerStore.getState().add('TSLA')
    const { id } = seedUser('a@example.com')
    signInAs('a@example.com')
    const { result } = renderHook(() => useWatchlist(), { wrapper })
    await waitFor(() => expect(result.current.tickers).toEqual(['AAPL', 'TSLA']))
    await waitFor(() => expect(symbolsFor(id)).toEqual(['AAPL', 'TSLA']))
    expect(localStorage.getItem(`stock-tool.imported:${id}`)).toBe('1')

    // Second session: the cloud list wins even if the local list changed meanwhile.
    act(() => result.current.clear())
    await waitFor(() => expect(symbolsFor(id)).toEqual([]))
    useTickerStore.getState().add('GME')
    const again = renderHook(() => useWatchlist(), { wrapper })
    await waitFor(() => expect(again.result.current.source).toBe('cloud'))
    await new Promise((r) => setTimeout(r, 20))
    expect(symbolsFor(id)).toEqual([])
  })

  it('does not import when the cloud list already has symbols', async () => {
    useTickerStore.getState().add('AAPL')
    const { id } = seedUser('a@example.com')
    seedSymbols(id, ['MSFT'])
    signInAs('a@example.com')
    const { result } = renderHook(() => useWatchlist(), { wrapper })
    await waitFor(() => expect(result.current.tickers).toEqual(['MSFT']))
    await new Promise((r) => setTimeout(r, 20))
    expect(symbolsFor(id)).toEqual(['MSFT'])
  })

  it('falls back to local after sign-out', async () => {
    seedUser('a@example.com')
    signInAs('a@example.com')
    const { result } = renderHook(() => useWatchlist(), { wrapper })
    await waitFor(() => expect(result.current.source).toBe('cloud'))
    await act(async () => {
      await supabase.auth.signOut()
    })
    await waitFor(() => expect(result.current.source).toBe('local'))
  })
})
