import { useCallback, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { supabase } from '@/lib/supabase'
import { normaliseSymbol } from '@/lib/api'
import { MAX_TRACKED, useTickerStore } from '@/stores/tickers'
import { getDefaultWatchlistId, listSymbols, setSymbols } from './watchlist-repo'

export type WatchlistSource = 'local' | 'cloud'

export interface Watchlist {
  tickers: string[]
  source: WatchlistSource
  /** True while the cloud list is loading for the first time. */
  isLoading: boolean
  /** Last save error, if the cloud write failed (the list rolls back). */
  error: string | null
  add: (symbol: string) => void
  remove: (symbol: string) => void
  toggle: (symbol: string) => void
  move: (symbol: string, delta: number) => void
  has: (symbol: string) => boolean
  clear: () => void
}

export const watchlistKeys = {
  id: (userId: string) => ['watchlist', 'id', userId] as const,
  items: (watchlistId: string) => ['watchlist', 'items', watchlistId] as const,
}

const importedKey = (userId: string) => `stock-tool.imported:${userId}`

function applyMove(list: string[], symbol: string, delta: number): string[] {
  const from = list.indexOf(symbol)
  if (from < 0 || delta === 0) return list
  const to = Math.min(list.length - 1, Math.max(0, from + delta))
  if (to === from) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

/**
 * One watchlist API for the whole app. Signed out: the persisted zustand store.
 * Signed in: the user's default Supabase watchlist, written atomically through the RPC with
 * optimistic updates. On the first sign-in a non-empty local list is imported once.
 */
export function useWatchlist(): Watchlist {
  const { user } = useAuth()
  const local = useTickerStore()
  const queryClient = useQueryClient()
  const userId = user?.id ?? null
  const client = supabase

  const idQuery = useQuery({
    queryKey: watchlistKeys.id(userId ?? ''),
    queryFn: () => getDefaultWatchlistId(client!, userId!),
    enabled: Boolean(client && userId),
    staleTime: Infinity,
  })
  const watchlistId = idQuery.data ?? null

  const itemsQuery = useQuery({
    queryKey: watchlistKeys.items(watchlistId ?? ''),
    queryFn: () => listSymbols(client!, watchlistId!),
    enabled: Boolean(client && watchlistId),
    staleTime: 60_000,
  })

  const save = useMutation({
    mutationFn: (symbols: string[]) => setSymbols(client!, watchlistId!, symbols),
    onMutate: async (symbols) => {
      const key = watchlistKeys.items(watchlistId!)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<string[]>(key)
      queryClient.setQueryData<string[]>(key, symbols)
      return { previous }
    },
    onError: (_err, _symbols, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(watchlistKeys.items(watchlistId!), ctx.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: watchlistKeys.items(watchlistId!) })
    },
  })

  // First sign-in: import a non-empty local list into an empty cloud list, once per user.
  useEffect(() => {
    if (!userId || !watchlistId || !itemsQuery.isSuccess) return
    let done = false
    try {
      done = localStorage.getItem(importedKey(userId)) === '1'
    } catch {
      done = true
    }
    if (done) return
    try {
      localStorage.setItem(importedKey(userId), '1')
    } catch {
      // ignore
    }
    if (itemsQuery.data.length === 0 && local.tickers.length > 0) {
      save.mutate(local.tickers.slice(0, MAX_TRACKED))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, watchlistId, itemsQuery.isSuccess])

  const cloudTickers = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])
  const cloud = Boolean(userId)
  const tickers = cloud ? cloudTickers : local.tickers
  const { mutate } = save

  const write = useCallback(
    (next: string[]) => {
      if (!watchlistId) return
      mutate(next.slice(0, MAX_TRACKED))
    },
    [watchlistId, mutate],
  )

  const cloudApi = useMemo<Pick<Watchlist, 'add' | 'remove' | 'toggle' | 'move' | 'has' | 'clear'>>(() => {
    const has = (s: string) => cloudTickers.includes(normaliseSymbol(s))
    const add = (s: string) => {
      const clean = normaliseSymbol(s)
      if (!clean || has(clean) || cloudTickers.length >= MAX_TRACKED) return
      write([...cloudTickers, clean])
    }
    const remove = (s: string) => write(cloudTickers.filter((t) => t !== normaliseSymbol(s)))
    return {
      has,
      add,
      remove,
      toggle: (s) => (has(s) ? remove(s) : add(s)),
      move: (s, delta) => {
        const next = applyMove(cloudTickers, normaliseSymbol(s), delta)
        if (next !== cloudTickers) write(next)
      },
      clear: () => write([]),
    }
  }, [cloudTickers, write])

  if (!cloud) {
    return {
      tickers: local.tickers,
      source: 'local',
      isLoading: false,
      error: null,
      add: local.add,
      remove: local.remove,
      toggle: local.toggle,
      move: local.move,
      has: local.has,
      clear: local.clear,
    }
  }
  return {
    tickers,
    source: 'cloud',
    isLoading: idQuery.isPending || (Boolean(watchlistId) && itemsQuery.isPending),
    error: idQuery.error?.message ?? itemsQuery.error?.message ?? save.error?.message ?? null,
    ...cloudApi,
  }
}
