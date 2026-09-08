import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { makeTestQueryClient } from '@/test/render'
import { makeQueryClient } from '@/app/providers'
import { ApiError } from './api'
import { queryKeys, retryUnlessNotFound, useQuote, useSearch } from './queries'

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
}

describe('query hooks', () => {
  it('useSearch is disabled for blank input and resolves for a term', async () => {
    const blank = renderHook(() => useSearch('   '), { wrapper })
    expect(blank.result.current.fetchStatus).toBe('idle')

    const { result } = renderHook(() => useSearch('apple'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]?.symbol).toBe('AAPL')
  })

  it('useQuote surfaces a 404 as an ApiError without retrying (app client defaults)', async () => {
    let hits = 0
    server.use(
      http.get(`${API_URL}/quote/:symbol`, () => {
        hits += 1
        return HttpResponse.json({ detail: 'Unknown ticker: NOPE' }, { status: 404 })
      }),
    )
    const appWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useQuote('NOPE'), { wrapper: appWrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect(hits).toBe(1)
  })

  it('normalises symbols in query keys', () => {
    expect(queryKeys.quote(' aapl ')).toEqual(['quote', 'AAPL'])
    expect(queryKeys.quotes(['msft', 'aapl'])).toEqual(['quotes', 'AAPL,MSFT'])
    expect(queryKeys.search('  Apple ')).toEqual(['search', 'apple'])
  })

  it('retry policy', () => {
    expect(retryUnlessNotFound(0, new ApiError(404, 'nope'))).toBe(false)
    expect(retryUnlessNotFound(0, new ApiError(502, 'down'))).toBe(true)
    expect(retryUnlessNotFound(2, new Error('x'))).toBe(false)
  })
})
