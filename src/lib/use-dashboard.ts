import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { supabase } from '@/lib/supabase'
import { makeNamed, useDashboardStore } from '@/stores/dashboard'
import { layoutsEqual, newId, starterLayout, type DashboardLayout, type NamedLayout } from './dashboard-layout'
import { deleteLayout, listLayouts, saveLayout, setDefaultLayout } from './dashboard-repo'

export const SAVE_DEBOUNCE_MS = 1000

export interface Dashboard {
  layouts: NamedLayout[]
  active: NamedLayout | null
  source: 'local' | 'cloud'
  isLoading: boolean
  error: string | null
  /** True while an edit is waiting for its debounced save or the save is in flight. */
  isSaving: boolean
  select: (id: string) => void
  /** Replace the active layout; persisted after `SAVE_DEBOUNCE_MS` of quiet. */
  update: (layout: DashboardLayout) => void
  create: (name: string, from?: DashboardLayout) => void
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  setDefault: (id: string) => void
  /** Persist immediately (used before switching layouts and on unmount). */
  flush: () => void
}

export const dashboardKeys = { list: (userId: string) => ['dashboard', 'layouts', userId] as const }
const EMPTY: NamedLayout[] = []

const activeKey = (userId: string) => `stock-tool.dashboard.active:${userId}`

/**
 * Named dashboard layouts with one active. Signed out: the persisted zustand store.
 * Signed in: `dashboard_layouts` rows. Edits land in local state immediately and are written
 * once per second of quiet; a new account inherits the local active layout as its starter.
 */
export function useDashboard(): Dashboard {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const cloud = Boolean(userId && supabase)
  const local = useDashboardStore()
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: dashboardKeys.list(userId ?? ''),
    queryFn: () => listLayouts(supabase!, userId!),
    enabled: cloud,
    staleTime: 60_000,
  })

  const save = useMutation({
    mutationFn: (named: NamedLayout) => saveLayout(supabase!, userId!, named),
    onSuccess: (saved) => {
      queryClient.setQueryData<NamedLayout[]>(dashboardKeys.list(userId!), (prev) => {
        const list = prev ?? []
        return list.some((l) => l.id === saved.id) ? list.map((l) => (l.id === saved.id ? saved : l)) : [...list, saved]
      })
    },
  })

  // Seed a new account with the local active layout (or the starter) exactly once.
  const seeded = useRef<string | null>(null)
  useEffect(() => {
    if (!cloud || !listQuery.isSuccess || listQuery.data.length > 0 || seeded.current === userId) return
    seeded.current = userId
    const source = local.layouts.find((l) => l.id === local.activeId)
    save.mutate({ ...makeNamed(source?.name ?? 'My dashboard', source?.layout ?? starterLayout(), true), id: newId() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud, userId, listQuery.isSuccess, listQuery.data?.length])

  const cloudLayouts = listQuery.data
  const localLayouts = local.layouts
  const layouts = useMemo(() => (cloud ? (cloudLayouts ?? EMPTY) : localLayouts), [cloud, cloudLayouts, localLayouts])

  // Active selection: cloud remembers per user in localStorage, falling back to the default row.
  const [cloudActiveId, setCloudActiveId] = useState<string | null>(null)
  useEffect(() => {
    if (!userId) return
    try {
      setCloudActiveId(localStorage.getItem(activeKey(userId)))
    } catch {
      setCloudActiveId(null)
    }
  }, [userId])
  const activeId = cloud
    ? (layouts.some((l) => l.id === cloudActiveId) ? cloudActiveId : (layouts.find((l) => l.isDefault) ?? layouts[0])?.id) ?? null
    : local.activeId

  // Draft: the layout being edited, ahead of persistence.
  const [draft, setDraft] = useState<{ id: string; layout: DashboardLayout } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<NamedLayout | null>(null)

  const persist = useCallback(
    (named: NamedLayout) => {
      if (cloud) save.mutate(named)
      else local.upsert(named)
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

  useEffect(() => flush, [flush]) // flush on unmount

  const stored = useMemo(() => layouts.find((l) => l.id === activeId) ?? null, [layouts, activeId])
  const active = useMemo<NamedLayout | null>(
    () => (stored && draft?.id === stored.id ? { ...stored, layout: draft.layout } : stored),
    [stored, draft],
  )

  const update = useCallback(
    (layout: DashboardLayout) => {
      if (!stored) return
      if (layoutsEqual(layout, active?.layout ?? stored.layout)) return
      setDraft({ id: stored.id, layout })
      pending.current = { ...stored, layout, updatedAt: new Date().toISOString() }
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
    (name: string, from?: DashboardLayout) => {
      flush()
      const named = makeNamed(name.trim() || 'Untitled', from ?? starterLayout(), layouts.length === 0)
      persist(named)
      select(named.id)
    },
    [flush, layouts.length, persist, select],
  )

  const rename = useCallback(
    (id: string, name: string) => {
      const target = layouts.find((l) => l.id === id)
      if (!target || !name.trim()) return
      flush()
      persist({ ...target, name: name.trim(), layout: draft?.id === id ? draft.layout : target.layout })
    },
    [layouts, flush, persist, draft],
  )

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteLayout(supabase!, id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<NamedLayout[]>(dashboardKeys.list(userId!), (prev) => (prev ?? []).filter((l) => l.id !== id))
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

  const defaultMutation = useMutation({
    mutationFn: (id: string) => setDefaultLayout(supabase!, userId!, id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<NamedLayout[]>(dashboardKeys.list(userId!), (prev) =>
        (prev ?? []).map((l) => ({ ...l, isDefault: l.id === id })),
      )
    },
  })
  const setDefault = useCallback(
    (id: string) => {
      if (cloud) defaultMutation.mutate(id)
      else local.setDefault(id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cloud, defaultMutation.mutate, local.setDefault],
  )

  const error =
    listQuery.error?.message ?? save.error?.message ?? removeMutation.error?.message ?? defaultMutation.error?.message ?? null

  return useMemo<Dashboard>(
    () => ({
      layouts,
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
      setDefault,
      flush,
    }),
    [layouts, active, cloud, listQuery.isPending, listQuery.data?.length, save.isPending, error, select, update, create, rename, remove, setDefault, flush],
  )
}
