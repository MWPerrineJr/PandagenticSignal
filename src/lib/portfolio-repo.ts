/** Supabase access for `portfolios`; every call runs under RLS as the user. */
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseStoredHoldings, serialiseHoldings, type Portfolio } from './portfolio'

export class PortfolioRepoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PortfolioRepoError'
  }
}

function fail(context: string, error: { message: string } | null): never {
  throw new PortfolioRepoError(`${context}: ${error?.message ?? 'unknown error'}`)
}

interface Row {
  id: string
  name: string
  holdings: unknown
  updated_at: string
}

const COLUMNS = 'id, name, holdings, updated_at'

function toPortfolio(row: Row): Portfolio {
  let parsed: ReturnType<typeof parseStoredHoldings>
  try {
    parsed = parseStoredHoldings(row.holdings)
  } catch {
    parsed = { mode: 'weight', holdings: [] }
  }
  return { id: row.id, name: row.name, ...parsed, updatedAt: row.updated_at }
}

export async function listPortfolios(client: SupabaseClient, userId: string): Promise<Portfolio[]> {
  const { data, error } = await client.from('portfolios').select(COLUMNS).eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) fail('load portfolios', error)
  return ((data ?? []) as Row[]).map(toPortfolio)
}

export async function savePortfolio(client: SupabaseClient, userId: string, portfolio: Portfolio): Promise<Portfolio> {
  const { data, error } = await client
    .from('portfolios')
    .upsert({ id: portfolio.id, user_id: userId, name: portfolio.name, holdings: serialiseHoldings(portfolio) }, { onConflict: 'id' })
    .select(COLUMNS)
    .single()
  if (error || !data) fail('save portfolio', error)
  return toPortfolio(data as Row)
}

export async function deletePortfolio(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('portfolios').delete().eq('id', id)
  if (error) fail('delete portfolio', error)
}
