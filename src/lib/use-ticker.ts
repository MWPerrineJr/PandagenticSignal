import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { normaliseSymbol } from './api'

export const TICKER_PARAM = 't'

/**
 * The selected ticker lives in the URL (`?t=AAPL`) so every tab shares it and links are
 * shareable. Returns `null` when nothing is selected.
 */
export function useTicker(): [string | null, (symbol: string | null) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get(TICKER_PARAM)
  const ticker = raw ? normaliseSymbol(raw) : null

  const setTicker = useCallback(
    (symbol: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const clean = symbol ? normaliseSymbol(symbol) : ''
          if (clean) next.set(TICKER_PARAM, clean)
          else next.delete(TICKER_PARAM)
          return next
        },
        { replace: false },
      )
    },
    [setParams],
  )

  return [ticker, setTicker]
}
