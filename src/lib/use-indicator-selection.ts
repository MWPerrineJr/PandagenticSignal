import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { supabase } from '@/lib/supabase'
import { useIndicatorStore } from '@/stores/indicators'
import { DEFAULT_TOKENS, MAX_INDICATORS, parseTokens, tokensEqual } from './indicators'
import { loadIndicatorSettings, saveIndicatorSettings } from './indicator-repo'

export const SAVE_DEBOUNCE_MS = 1000
export const indicatorKeys = { settings: (userId: string) => ['indicator-settings', userId] as const }

export interface IndicatorSelection {
  tokens: string[]
  source: 'local' | 'cloud'
  isLoading: boolean
  isSaving: boolean
  error: string | null
  setTokens: (tokens: string[]) => void
  reset: () => void
  flush: () => void
}

/**
 * The chart indicator selection. Signed out: the persisted zustand store. Signed in: the
 * account's `indicator_settings` row, written once per second of quiet; a new account inherits
 * the local selection. Mirrors `usePortfolios`, minus the list.
 */
export function useIndicatorSelection(): IndicatorSelection {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const cloud = Boolean(userId && supabase)
  const local = useIndicatorStore()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: indicatorKeys.settings(userId ?? ''),
    queryFn: () => loadIndicatorSettings(supabase!, userId!),
    enabled: cloud,
    staleTime: 60_000,
  })

  const [draft, setDraft] = useState<string[] | null>(null)
  const save = useMutation({
    mutationFn: (tokens: string[]) => saveIndicatorSettings(supabase!, userId!, tokens),
    onSuccess: (saved) => {
      queryClient.setQueryData(indicatorKeys.settings(userId!), saved)
      setDraft((d) => (d && tokensEqual(d, saved) ? null : d))
    },
  })

  // Seed a new account from the local selection exactly once.
  const seeded = useRef<string | null>(null)
  useEffect(() => {
    if (!cloud || !query.isSuccess || query.data !== null || seeded.current === userId) return
    seeded.current = userId
    save.mutate(local.tokens)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud, userId, query.isSuccess, query.data])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string[] | null>(null)

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (pending.current) {
      save.mutate(pending.current)
      pending.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.mutate])

  useEffect(() => flush, [flush])

  const cloudTokens = query.data ?? null
  const tokens = useMemo(
    () => (cloud ? (draft ?? cloudTokens ?? [...DEFAULT_TOKENS]) : local.tokens),
    [cloud, draft, cloudTokens, local.tokens],
  )

  const setTokens = useCallback(
    (next: string[]) => {
      const clean = parseTokens(next).slice(0, MAX_INDICATORS)
      if (tokensEqual(clean, tokens)) return
      if (!cloud) {
        local.setTokens(clean)
        return
      }
      // Show the change now, write it after a pause.
      setDraft(clean)
      pending.current = clean
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cloud, tokens, local.setTokens, flush],
  )

  const reset = useCallback(() => setTokens([...DEFAULT_TOKENS]), [setTokens])

  return useMemo<IndicatorSelection>(
    () => ({
      tokens,
      source: cloud ? 'cloud' : 'local',
      isLoading: cloud && query.isPending,
      isSaving: Boolean(pending.current) || save.isPending,
      error: query.error?.message ?? save.error?.message ?? null,
      setTokens,
      reset,
      flush,
    }),
    [tokens, cloud, query.isPending, query.error, save.isPending, save.error, setTokens, reset, flush],
  )
}
