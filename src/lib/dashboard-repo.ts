/** Supabase access for `dashboard_layouts`; every call runs under RLS as the user. */
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseLayout, starterLayout, type DashboardLayout, type NamedLayout } from './dashboard-layout'

export class DashboardRepoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DashboardRepoError'
  }
}

function fail(context: string, error: { message: string } | null): never {
  throw new DashboardRepoError(`${context}: ${error?.message ?? 'unknown error'}`)
}

interface Row {
  id: string
  name: string
  layout: unknown
  is_default: boolean
  updated_at: string
}

function toNamed(row: Row): NamedLayout {
  let layout: DashboardLayout
  try {
    layout = parseLayout(row.layout)
  } catch {
    layout = starterLayout()
  }
  return { id: row.id, name: row.name, isDefault: row.is_default, layout, updatedAt: row.updated_at }
}

export async function listLayouts(client: SupabaseClient, userId: string): Promise<NamedLayout[]> {
  const { data, error } = await client
    .from('dashboard_layouts')
    .select('id, name, layout, is_default, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) fail('load dashboards', error)
  return ((data ?? []) as Row[]).map(toNamed)
}

export async function saveLayout(client: SupabaseClient, userId: string, named: NamedLayout): Promise<NamedLayout> {
  const { data, error } = await client
    .from('dashboard_layouts')
    .upsert(
      { id: named.id, user_id: userId, name: named.name, layout: named.layout, is_default: named.isDefault },
      { onConflict: 'id' },
    )
    .select('id, name, layout, is_default, updated_at')
    .single()
  if (error || !data) fail('save dashboard', error)
  return toNamed(data as Row)
}

export async function deleteLayout(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('dashboard_layouts').delete().eq('id', id)
  if (error) fail('delete dashboard', error)
}

/** Only one default per user (partial unique index), so clear the others first. */
export async function setDefaultLayout(client: SupabaseClient, userId: string, id: string): Promise<void> {
  const cleared = await client.from('dashboard_layouts').update({ is_default: false }).eq('user_id', userId).eq('is_default', true)
  if (cleared.error) fail('clear default', cleared.error)
  const set = await client.from('dashboard_layouts').update({ is_default: true }).eq('id', id)
  if (set.error) fail('set default', set.error)
}
