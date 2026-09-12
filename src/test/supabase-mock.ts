/**
 * In-memory stand-in for `@/lib/supabase`. Supports exactly the query-builder subset the app
 * uses (select/eq/order/limit/maybeSingle/single, insert, rpc) plus password/OTP auth.
 * Signed out by default; call `seedUser` + `signInAs` (or drive the login page) in tests.
 */
import type { Session, User } from '@supabase/supabase-js'

type Row = Record<string, unknown>
type Listener = (event: string, session: Session | null) => void

interface State {
  tables: Record<string, Row[]>
  users: Map<string, { id: string; email: string; password: string }>
  session: Session | null
  listeners: Set<Listener>
  failNextRpc: string | null
  lastOAuth: { provider: string; options?: { redirectTo?: string; skipBrowserRedirect?: boolean } } | null
}

let seq = 0
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

export const state: State = {
  tables: { watchlists: [], watchlist_items: [], dashboard_layouts: [], portfolios: [], indicator_settings: [] },
  users: new Map(),
  session: null,
  listeners: new Set(),
  failNextRpc: null,
  lastOAuth: null,
}

export function resetSupabaseMock() {
  state.tables = { watchlists: [], watchlist_items: [], dashboard_layouts: [], portfolios: [], indicator_settings: [] }
  state.users.clear()
  state.session = null
  state.listeners.clear()
  state.failNextRpc = null
  state.lastOAuth = null
  seq = 0
}

function makeSession(id: string, email: string): Session {
  const user = { id, email, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' } as unknown as User
  return { access_token: 't', refresh_token: 'r', expires_in: 3600, token_type: 'bearer', user } as Session
}

/** Mirrors the `handle_new_user` trigger: a default watchlist per user. */
export function seedUser(email: string, password = 'password123'): { id: string } {
  const id = uuid()
  state.users.set(email, { id, email, password })
  state.tables.watchlists!.push({ id: uuid(), user_id: id, name: 'Watchlist', position: 0 })
  return { id }
}

export function seedSymbols(userId: string, symbols: string[]) {
  const list = state.tables.watchlists!.find((w) => w.user_id === userId)!
  symbols.forEach((symbol, position) =>
    state.tables.watchlist_items!.push({ id: uuid(), watchlist_id: list.id, symbol, position }),
  )
}

export function seedPortfolio(userId: string, row: { id: string; name: string; holdings: unknown; updated_at?: string }) {
  state.tables.portfolios!.push({ user_id: userId, updated_at: row.updated_at ?? '2026-01-01T00:00:00Z', ...row })
}

export function symbolsFor(userId: string): string[] {
  const list = state.tables.watchlists!.find((w) => w.user_id === userId)
  if (!list) return []
  return state.tables.watchlist_items!
    .filter((r) => r.watchlist_id === list.id)
    .sort((a, b) => (a.position as number) - (b.position as number))
    .map((r) => r.symbol as string)
}

function setSession(next: Session | null, event: string) {
  state.session = next
  for (const l of state.listeners) l(event, next)
}

export function signInAs(email: string) {
  const u = state.users.get(email)
  if (!u) throw new Error(`no seeded user ${email}`)
  setSession(makeSession(u.id, u.email), 'SIGNED_IN')
}

class Query implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private filters: Array<[string, unknown]> = []
  private orderBy: { col: string; asc: boolean } | null = null
  private max: number | null = null
  private mode: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
  private patch: Row = {}
  private singleMode: 'maybe' | 'one' | null = null
  private pending: Row[] = []
  private table: string

  constructor(table: string) {
    this.table = table
  }

  select() {
    return this
  }
  eq(col: string, value: unknown) {
    this.filters.push([col, value])
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, asc: opts?.ascending ?? true }
    return this
  }
  limit(n: number) {
    this.max = n
    return this
  }
  maybeSingle() {
    this.singleMode = 'maybe'
    return this
  }
  single() {
    this.singleMode = 'one'
    return this
  }
  insert(rows: Row | Row[]) {
    this.mode = 'insert'
    this.pending = Array.isArray(rows) ? rows : [rows]
    return this
  }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.mode = 'upsert'
    this.pending = Array.isArray(rows) ? rows : [rows]
    this.patch = { onConflict: opts?.onConflict ?? 'id' }
    return this
  }
  update(patch: Row) {
    this.mode = 'update'
    this.patch = patch
    return this
  }
  delete() {
    this.mode = 'delete'
    return this
  }

  private run(): { data: unknown; error: { message: string } | null } {
    const table = state.tables[this.table] ?? (state.tables[this.table] = [])
    let rows: Row[]
    const matches = (r: Row) => this.filters.every(([c, v]) => r[c] === v)
    if (this.mode === 'insert') {
      rows = this.pending.map((r) => ({ id: uuid(), ...r }))
      table.push(...rows)
    } else if (this.mode === 'upsert') {
      const key = String(this.patch.onConflict)
      rows = this.pending.map((r) => {
        const existing = table.find((t) => t[key] === r[key])
        const now = new Date().toISOString()
        if (existing) {
          Object.assign(existing, r, { updated_at: now })
          return existing
        }
        const created = { id: uuid(), updated_at: now, ...r }
        table.push(created)
        return created
      })
    } else if (this.mode === 'update') {
      rows = table.filter(matches)
      for (const r of rows) Object.assign(r, this.patch, { updated_at: new Date().toISOString() })
    } else if (this.mode === 'delete') {
      rows = table.filter(matches)
      state.tables[this.table] = table.filter((r) => !matches(r))
    } else {
      rows = table.filter(matches)
      if (this.orderBy) {
        const { col, asc } = this.orderBy
        rows = [...rows].sort((a, b) => {
          const av = a[col] as number | string
          const bv = b[col] as number | string
          return (av < bv ? -1 : av > bv ? 1 : 0) * (asc ? 1 : -1)
        })
      }
      if (this.max !== null) rows = rows.slice(0, this.max)
    }
    if (this.singleMode === 'maybe') return { data: rows[0] ?? null, error: null }
    if (this.singleMode === 'one') return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: 'no rows' } }
    return { data: rows, error: null }
  }

  then<R1 = unknown, R2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected)
  }
}

function rpc(name: string, args: Record<string, unknown>) {
  if (state.failNextRpc) {
    const message = state.failNextRpc
    state.failNextRpc = null
    return Promise.resolve({ data: null, error: { message } })
  }
  if (name !== 'set_watchlist_items') return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } })
  const listId = args.p_watchlist_id as string
  const symbols = args.p_symbols as string[]
  const list = state.tables.watchlists!.find((w) => w.id === listId)
  if (!list || list.user_id !== state.session?.user.id) {
    return Promise.resolve({ data: null, error: { message: 'watchlist not found' } })
  }
  if (symbols.length > 20) return Promise.resolve({ data: null, error: { message: 'a watchlist holds at most 20 symbols' } })
  state.tables.watchlist_items = state.tables.watchlist_items!.filter((r) => r.watchlist_id !== listId)
  symbols.forEach((symbol, position) =>
    state.tables.watchlist_items!.push({ id: uuid(), watchlist_id: listId, symbol, position }),
  )
  return Promise.resolve({ data: null, error: null })
}

const auth = {
  getSession: async () => ({ data: { session: state.session }, error: null }),
  onAuthStateChange: (cb: Listener) => {
    state.listeners.add(cb)
    return { data: { subscription: { unsubscribe: () => state.listeners.delete(cb) } } }
  },
  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    const u = state.users.get(email)
    if (!u || u.password !== password) {
      return { data: { session: null, user: null }, error: { message: 'Invalid login credentials' } }
    }
    const session = makeSession(u.id, u.email)
    setSession(session, 'SIGNED_IN')
    return { data: { session, user: session.user }, error: null }
  },
  signUp: async ({ email, password }: { email: string; password: string }) => {
    if (state.users.has(email)) return { data: { session: null, user: null }, error: { message: 'User already registered' } }
    const { id } = seedUser(email, password)
    const session = makeSession(id, email)
    setSession(session, 'SIGNED_IN')
    return { data: { session, user: session.user }, error: null }
  },
  signInWithOtp: async ({ email }: { email: string }) =>
    email.includes('@') ? { data: {}, error: null } : { data: {}, error: { message: 'Invalid email' } },
  signInWithOAuth: async (opts: { provider: string; options?: { redirectTo?: string; skipBrowserRedirect?: boolean } }) => {
    state.lastOAuth = opts
    return { data: { url: 'https://accounts.google.com/mock-oauth', provider: opts.provider }, error: null }
  },
  signOut: async () => {
    setSession(null, 'SIGNED_OUT')
    return { error: null }
  },
}

export const isSupabaseConfigured = true
export const supabase = {
  auth,
  from: (table: string) => new Query(table),
  rpc,
}
