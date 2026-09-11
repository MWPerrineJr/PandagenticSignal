import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { supabase } from '@/lib/supabase'
import { usePortfolioStore } from '@/stores/portfolios'
import { holdingsEqual, makePortfolio, starterPortfolio, type Holding, type HoldingMode, type Portfolio } from './portfolio'
import { deletePortfolio, listPortfolios, savePortfolio } from './portfolio-repo'

export const SAVE_DEBOUNCE_MS = 1000

export interface Portfolios {
  portfolios: Portfolio[]
  active: Portfolio | null
  source: 'local' | 'cloud'
  isLoading: boolean
  error: string | null
  isSaving: boolean
  select: (id: string) => void
  /** Replace the active holdings; persisted after `SAVE_DEBOUNCE_MS` of quiet. */
  update: (holdings: Holding[], mode: HoldingMode) => void
  create: (name: string, holdings?: Holding[], mode?: HoldingMode) => void
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  flush: () => void
}

export const portfolioKeys = { list: (userId: string) => ['portfolios', userId] as const }
const EMPTY: Portfolio[] = []
const activeKey = (userId: string) => `stock-tool.portfolios.active:${userId}`

type Draft = Pick<Portfolio, 'id' | 'holdings' | 'mode'>

/**
 * Named portfolios with one active. Signed out: the persisted zustand store. Signed in:
 * `portfolios` rows. Edits show immediately and are written once per second of quiet; a new
 * account inherits the local active portfolio.
 */
export function usePortfolios(): Portfolios {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const cloud = Boolean(userId && supabase)
  const local = usePortfolioStore()
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: portfolioKeys.list(userId ?? ''),
    queryFn: () => listPortfolios(supabase!, userId!),
    enabled: cloud,
    staleTime: 60_000,
  })

  const save = useMutation({
    mutationFn: (p: Portfolio) => savePortfolio(supabase!, userId!, p),
    onSuccess: (saved) => {
      queryClient.setQueryData<Portfolio[]>(portfolioKeys.list(userId!), (prev) => {
        const list = prev ?? []
        return list.some((p) => p.id === saved.id) ? list.map((p) => (p.id === saved.id ? saved : p)) : [...list, saved]
      })
    },
  })

  // Seed a new account with the local active portfolio (or an empty starter) exactly once.
  const seeded = useRef<string | null>(null)
  useEffect(() => {
    if (!cloud || !listQuery.isSuccess || listQuery.data.length > 0 || seeded.current === userId) return
    seeded.current = userId
    const source = local.portfolios.find((p) => p.id === local.activeId)
    save.mutate(source ? { ...makePortfolio(source.name, source.holdings, source.mode) } : starterPortfolio())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud, userId, listQuery.isSuccess, listQuery.data?.length])

  const cloudList = listQuery.data
  const localList = local.portfolios
  const portfolios = useMemo(() => (cloud ? (cloudList ?? EMPTY) : localList), [cloud, cloudList, localList])

  const [cloudActiveId, setCloudActiveId] = useState<string | null>(null)
  useEffect(() => {
    if (!userId) return
    try {
      setCloudActiveId(localStorage.getItem(activeKey(userId)))
    } catch {
      setCloudActiveId(null)
    }
  }, [userId])
  const activeId = cloud ? (portfolios.some((p) => p.id === cloudActiveId) ? cloudActiveId : (portfolios[0]?.id ?? null)) : local.activeId

  const [draft, setDraft] = useState<Draft | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<Portfolio | null>(null)

  const persist = useCallback(
    (p: Portfolio) => {
      if (cloud) save.mutate(p)
      else local.upsert(p)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cloud, save.mutate, local.upsert],
  )

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (pending.current) {
      persist(pending.current)
      pending.current = null
    }
  }, [persist])

  useEffect(() => flush, [flush])

  const stored = useMemo(() => portfolios.find((p) => p.id === activeId) ?? null, [portfolios, activeId])
  const active = useMemo<Portfolio | null>(
    () => (stored && draft?.id === stored.id ? { ...stored, holdings: draft.holdings, mode: draft.mode } : stored),
    [stored, draft],
  )

  const update = useCallback(
    (holdings: Holding[], mode: HoldingMode) => {
      if (!stored) return
      if (holdingsEqual({ holdings, mode }, active ?? stored)) return
      setDraft({ id: stored.id, holdings, mode })
      pending.current = { ...stored, holdings, mode, updatedAt: new Date().toISOString() }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS)
    },
    [stored, active, flush],
  )

  const select = useCallback(
    (id: string) => {
      flush()
      setDraft(null)
      if (cloud) {
        setCloudActiveId(id)
        try {
          localStorage.setItem(activeKey(userId!), id)
        } catch {
          // ignore
        }
      } else local.setActive(id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cloud, userId, flush, local.setActive],
  )

  const create = useCallback(
    (name: string, holdings: Holding[] = [], mode: HoldingMode = 'weight') => {
      flush()
      const p = makePortfolio(name.trim() || 'Untitled', holdings, mode)
      persist(p)
      select(p.id)
    },
    [flush, persist, select],
  )

  const rename = useCallback(
    (id: string, name: string) => {
      const target = portfolios.find((p) => p.id === id)
      if (!target || !name.trim()) return
      flush()
      const current = draft?.id === id ? { holdings: draft.holdings, mode: draft.mode } : {}
      persist({ ...target, ...current, name: name.trim() })
    },
    [portfolios, flush, persist, draft],
  )

  const removeMutation = useMutation({
    mutationFn: (id: string) => deletePortfolio(supabase!, id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Portfolio[]>(portfolioKeys.list(userId!), (prev) => (prev ?? []).filter((p) => p.id !== id))
    },
  })
  const remove = useCallback(
    (id: string) => {
      if (timer.current) clearTimeout(timer.current)
      pending.current = null
      setDraft(null)
      if (cloud) {
        removeMutation.mutate(id)
        if (cloudActiveId === id) setCloudActiveId(null)
      } else local.remove(id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cloud, removeMutation.mutate, local.remove, cloudActiveId],
  )

  const error = listQuery.error?.message ?? save.error?.message ?? removeMutation.error?.message ?? null

  return useMemo<Portfolios>(
    () => ({
      portfolios,
      active,
      source: cloud ? 'cloud' : 'local',
      isLoading: cloud && (listQuery.isPending || (listQuery.data?.length === 0 && save.isPending)),
      error,
      isSaving: Boolean(pending.current) || save.isPending,
      select,
      update,
      create,
      rename,
      remove,
      flush,
    }),
    [portfolios, active, cloud, listQuery.isPending, listQuery.data?.length, save.isPending, error, select, update, create, rename, remove, flush],
  )
}
