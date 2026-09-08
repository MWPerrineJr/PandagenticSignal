/** Supabase access for the signed-in watchlist. Every call goes through RLS as the user. */
import type { SupabaseClient } from '@supabase/supabase-js'
import { normaliseSymbol } from './api'

export class WatchlistRepoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WatchlistRepoError'
  }
}

function fail(context: string, error: { message: string } | null): never {
  throw new WatchlistRepoError(`${context}: ${error?.message ?? 'unknown error'}`)
}

/** The user's first watchlist; the signup trigger creates one, but older users may need it made. */
export async function getDefaultWatchlistId(client: SupabaseClient, userId: string): Promise<string> {
  const found = await client
    .from('watchlists')
    .select('id')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (found.error) fail('load watchlist', found.error)
  if (found.data?.id) return found.data.id as string

  const created = await client
    .from('watchlists')
    .insert({ user_id: userId, name: 'Watchlist', position: 0 })
    .select('id')
    .single()
  if (created.error || !created.data) fail('create watchlist', created.error)
  return created.data.id as string
}

export async function listSymbols(client: SupabaseClient, watchlistId: string): Promise<string[]> {
  const { data, error } = await client
    .from('watchlist_items')
    .select('symbol, position')
    .eq('watchlist_id', watchlistId)
    .order('position', { ascending: true })
  if (error) fail('load symbols', error)
  return (data ?? []).map((row) => normaliseSymbol(String(row.symbol)))
}

/** Replace the whole list atomically (server-side RPC, max 20). */
export async function setSymbols(client: SupabaseClient, watchlistId: string, symbols: string[]): Promise<void> {
  const clean = Array.from(new Set(symbols.map(normaliseSymbol).filter(Boolean)))
  const { error } = await client.rpc('set_watchlist_items', { p_watchlist_id: watchlistId, p_symbols: clean })
  if (error) fail('save symbols', error)
}
