import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normaliseSymbol } from '@/lib/api'

export const MAX_TRACKED = 20

interface TickerState {
  /** Symbols the user is tracking, in insertion order. */
  tickers: string[]
  add: (symbol: string) => void
  remove: (symbol: string) => void
  toggle: (symbol: string) => void
  has: (symbol: string) => boolean
  /** Move a symbol by `delta` positions (negative = up); clamps at the ends. */
  move: (symbol: string, delta: number) => void
  clear: () => void
}

export const useTickerStore = create<TickerState>()(
  persist(
    (set, get) => ({
      tickers: [],
      add: (symbol) => {
        const clean = normaliseSymbol(symbol)
        if (!clean || get().tickers.includes(clean) || get().tickers.length >= MAX_TRACKED) return
        set({ tickers: [...get().tickers, clean] })
      },
      remove: (symbol) => {
        const clean = normaliseSymbol(symbol)
        set({ tickers: get().tickers.filter((t) => t !== clean) })
      },
      toggle: (symbol) => (get().has(symbol) ? get().remove(symbol) : get().add(symbol)),
      has: (symbol) => get().tickers.includes(normaliseSymbol(symbol)),
      move: (symbol, delta) => {
        const list = [...get().tickers]
        const from = list.indexOf(normaliseSymbol(symbol))
        if (from < 0 || delta === 0) return
        const to = Math.min(list.length - 1, Math.max(0, from + delta))
        if (to === from) return
        const [item] = list.splice(from, 1)
        list.splice(to, 0, item!)
        set({ tickers: list })
      },
      clear: () => set({ tickers: [] }),
    }),
    { name: 'stock-tool.tickers', version: 1 },
  ),
)
