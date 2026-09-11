/** Supabase access for `indicator_settings` (one row per user); runs under RLS as the user. */
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseTokens, tokenListSchema } from './indicators'

export class IndicatorRepoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IndicatorRepoError'
  }
}

function fail(context: string, error: { message: string } | null): never {
  throw new IndicatorRepoError(`${context}: ${error?.message ?? 'unknown error'}`)
}

/** The saved selection, or null when the account has never saved one. */
export async function loadIndicatorSettings(client: SupabaseClient, userId: string): Promise<string[] | null> {
  const { data, error } = await client.from('indicator_settings').select('tokens').eq('user_id', userId).maybeSingle()
  if (error) fail('load indicator settings', error)
  if (!data) return null
  const parsed = tokenListSchema.safeParse((data as { tokens: unknown }).tokens)
  return parsed.success ? parseTokens(parsed.data) : null
}

export async function saveIndicatorSettings(client: SupabaseClient, userId: string, tokens: string[]): Promise<string[]> {
  const { data, error } = await client
    .from('indicator_settings')
    .upsert({ user_id: userId, tokens }, { onConflict: 'user_id' })
    .select('tokens')
    .single()
  if (error || !data) fail('save indicator settings', error)
  return parseTokens((data as { tokens: unknown }).tokens)
}
