import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
// Lovable's Supabase connector writes VITE_SUPABASE_PUBLISHABLE_KEY; both names are accepted.
const key =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  ''

/** False when the env vars are missing: the app then runs without accounts (localStorage only). */
export const isSupabaseConfigured: boolean = Boolean(url && key)

export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url, key) : null
