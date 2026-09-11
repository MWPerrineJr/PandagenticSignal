import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_TOKENS, parseTokens } from '@/lib/indicators'

interface IndicatorState {
  tokens: string[]
  setTokens: (tokens: string[]) => void
  reset: () => void
}

/** Signed-out indicator selection, persisted in this browser. Signed in, the account row wins. */
export const useIndicatorStore = create<IndicatorState>()(
  persist(
    (set) => ({
      tokens: [...DEFAULT_TOKENS],
      setTokens: (tokens) => set({ tokens: parseTokens(tokens) }),
      reset: () => set({ tokens: [...DEFAULT_TOKENS] }),
    }),
    {
      name: 'stock-tool.indicators',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<IndicatorState>
        return { ...current, tokens: parseTokens(p.tokens) }
      },
    },
  ),
)
