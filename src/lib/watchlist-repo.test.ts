import type { SupabaseClient } from '@supabase/supabase-js'
import { seedSymbols, seedUser, signInAs, state, supabase, symbolsFor } from '@/test/supabase-mock'
import { WatchlistRepoError, getDefaultWatchlistId, listSymbols, setSymbols } from './watchlist-repo'

const client = supabase as unknown as SupabaseClient

describe('watchlist repo', () => {
  it('finds the trigger-created default watchlist', async () => {
    const { id } = seedUser('a@example.com')
    const listId = await getDefaultWatchlistId(client, id)
    expect(listId).toBe(state.tables.watchlists![0]!.id)
  })

  it('creates a watchlist for a user without one', async () => {
    const listId = await getDefaultWatchlistId(client, 'orphan')
    expect(state.tables.watchlists!.find((w) => w.id === listId)).toMatchObject({ user_id: 'orphan', name: 'Watchlist' })
  })

  it('lists symbols in position order', async () => {
    const { id } = seedUser('a@example.com')
    seedSymbols(id, ['MSFT', 'AAPL'])
    const listId = await getDefaultWatchlistId(client, id)
    expect(await listSymbols(client, listId)).toEqual(['MSFT', 'AAPL'])
  })

  it('setSymbols normalises, dedupes and replaces through the RPC', async () => {
    const { id } = seedUser('a@example.com')
    signInAs('a@example.com')
    const listId = await getDefaultWatchlistId(client, id)
    await setSymbols(client, listId, [' nvda ', 'aapl', 'NVDA', ''])
    expect(symbolsFor(id)).toEqual(['NVDA', 'AAPL'])
  })

  it('surfaces RPC errors as WatchlistRepoError', async () => {
    const { id } = seedUser('a@example.com')
    const listId = await getDefaultWatchlistId(client, id)
    await expect(setSymbols(client, listId, ['AAPL'])).rejects.toBeInstanceOf(WatchlistRepoError) // not signed in
    signInAs('a@example.com')
    state.failNextRpc = 'boom'
    await expect(setSymbols(client, listId, ['AAPL'])).rejects.toThrow(/save symbols: boom/)
  })
})
