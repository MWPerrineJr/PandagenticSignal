import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { ApiError, api, normaliseSymbol, type Interval, type Period, type PortfolioRequest, type RetirementRequest, type SimulateRequest } from './api'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export const queryKeys = {
  search: (q: string) => ['search', q.trim().toLowerCase()] as const,
  quote: (symbol: string) => ['quote', normaliseSymbol(symbol)] as const,
  quotes: (symbols: string[]) => ['quotes', symbols.map(normaliseSymbol).sort().join(',')] as const,
  history: (symbol: string, period: Period, interval: Interval) =>
    ['history', normaliseSymbol(symbol), period, interval] as const,
  indicators: (symbol: string, period: Period, interval: Interval) =>
    ['indicators', normaliseSymbol(symbol), period, interval] as const,
  recommendations: (symbol: string) => ['recommendations', normaliseSymbol(symbol)] as const,
  cryptoTop: (limit: number) => ['crypto', 'top', limit] as const,
  portfolioStats: (req: PortfolioRequest) => ['portfolio', 'stats', JSON.stringify(req)] as const,
  simulation: (req: SimulateRequest) => ['portfolio', 'simulate', JSON.stringify(req)] as const,
  retirement: (req: RetirementRequest | null) => ['retirement', req ? JSON.stringify(req) : ''] as const,
}

/** Never retry a client error (404 unknown symbol, 422 bad request, 429 rate limited). */
export function retryUnlessNotFound(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.isNotFound || error.status === 422 || error.status === 429)) return false
  return failureCount < 2
}

export function useSearch(q: string, limit = 8) {
  const query = q.trim()
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: ({ signal }) => api.search(query, limit, { signal }),
    enabled: query.length > 0,
    staleTime: 24 * HOUR,
    placeholderData: keepPreviousData,
  })
}

export function useQuote(symbol: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.quote(symbol ?? ''),
    queryFn: ({ signal }) => api.quote(symbol!, { signal }),
    enabled: Boolean(symbol),
    staleTime: MINUTE,
    refetchInterval: MINUTE,
  })
}

export function useQuotes(symbols: string[]) {
  return useQuery({
    queryKey: queryKeys.quotes(symbols),
    queryFn: ({ signal }) => api.quotes(symbols, { signal }),
    enabled: symbols.length > 0,
    staleTime: MINUTE,
    refetchInterval: MINUTE,
    placeholderData: keepPreviousData,
  })
}

export function useHistory(symbol: string | null | undefined, period: Period = '1y', interval: Interval = '1d') {
  return useQuery({
    queryKey: queryKeys.history(symbol ?? '', period, interval),
    queryFn: ({ signal }) => api.history(symbol!, period, interval, { signal }),
    enabled: Boolean(symbol),
    staleTime: 5 * MINUTE,
    placeholderData: keepPreviousData,
  })
}

export function useIndicators(symbol: string | null | undefined, period: Period = '1y', interval: Interval = '1d') {
  return useQuery({
    queryKey: queryKeys.indicators(symbol ?? '', period, interval),
    queryFn: ({ signal }) => api.indicators(symbol!, period, interval, { signal }),
    enabled: Boolean(symbol),
    staleTime: 5 * MINUTE,
    placeholderData: keepPreviousData,
  })
}

export function useRecommendations(symbol: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.recommendations(symbol ?? ''),
    queryFn: ({ signal }) => api.recommendations(symbol!, { signal }),
    enabled: Boolean(symbol),
    staleTime: HOUR,
  })
}

export function useCryptoTop(limit = 25) {
  return useQuery({
    queryKey: queryKeys.cryptoTop(limit),
    queryFn: ({ signal }) => api.cryptoTop(limit, { signal }),
    staleTime: MINUTE,
    refetchInterval: MINUTE,
    placeholderData: keepPreviousData,
  })
}

export function usePortfolioStats(req: PortfolioRequest | null) {
  return useQuery({
    queryKey: queryKeys.portfolioStats(req ?? { holdings: [], period: '2y' }),
    queryFn: ({ signal }) => api.portfolioAnalyse(req!, { signal }),
    enabled: Boolean(req && req.holdings.length > 0),
    staleTime: 5 * MINUTE,
    placeholderData: keepPreviousData,
  })
}

/** Runs only once a request is handed in (the page waits for "Run simulation"). */
export function useSimulation(req: SimulateRequest | null) {
  return useQuery({
    queryKey: queryKeys.simulation(req ?? { holdings: [], period: '2y', horizon_years: 0, n_sims: 0, initial_value: 0, monthly_contribution: 0 }),
    queryFn: ({ signal }) => api.portfolioSimulate(req!, { signal }),
    enabled: Boolean(req && req.holdings.length > 0),
    staleTime: 10 * MINUTE,
  })
}

/** Runs only once a request is handed in (the page waits for "Run Monte Carlo"). */
export function useRetirementProjection(req: RetirementRequest | null) {
  return useQuery({
    queryKey: queryKeys.retirement(req),
    queryFn: ({ signal }) => api.retirementProject(req!, { signal }),
    enabled: Boolean(req),
    staleTime: 10 * MINUTE,
  })
}

/** One history query per symbol (compare mode). Order of results matches `symbols`. */
export function useHistories(symbols: string[], period: Period = '1y', interval: Interval = '1d') {
  return useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: queryKeys.history(symbol, period, interval),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.history(symbol, period, interval, { signal }),
      staleTime: 5 * MINUTE,
      placeholderData: keepPreviousData,
    })),
  })
}
