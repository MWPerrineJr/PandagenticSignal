import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useTicker } from './use-ticker'

function wrapperFor(route: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
}

describe('useTicker', () => {
  it('reads and normalises the t param', () => {
    const { result } = renderHook(() => useTicker(), { wrapper: wrapperFor('/charts?t=aapl') })
    expect(result.current[0]).toBe('AAPL')
  })

  it('is null when absent and writes/clears the param', () => {
    const { result } = renderHook(() => ({ ticker: useTicker(), location: useLocation() }), {
      wrapper: wrapperFor('/charts?period=6mo'),
    })
    expect(result.current.ticker[0]).toBeNull()

    act(() => result.current.ticker[1]('msft'))
    expect(result.current.ticker[0]).toBe('MSFT')
    expect(result.current.location.search).toBe('?period=6mo&t=MSFT')

    act(() => result.current.ticker[1](null))
    expect(result.current.ticker[0]).toBeNull()
    expect(result.current.location.search).toBe('?period=6mo')
  })
})
