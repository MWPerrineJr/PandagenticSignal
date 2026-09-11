import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { parseSharedIndicators, useChartParams } from './use-chart-params'

function wrapperFor(route: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
}

function setup(route = '/charts?t=AAPL') {
  return renderHook(() => ({ params: useChartParams(), location: useLocation() }), { wrapper: wrapperFor(route) })
}

describe('useChartParams', () => {
  it('defaults to 1y daily with no shared indicators', () => {
    const { result } = setup()
    expect(result.current.params.period).toBe('1y')
    expect(result.current.params.interval).toBe('1d')
    expect(result.current.params.sharedIndicators).toBeNull()
  })

  it('reads values from the URL and ignores invalid ones', () => {
    const { result } = setup('/charts?period=6mo&interval=1wk')
    expect(result.current.params.period).toBe('6mo')
    expect(result.current.params.interval).toBe('1wk')
    expect(setup('/charts?period=7d&interval=2h').result.current.params).toMatchObject({ period: '1y', interval: '1d' })
  })

  it('writes changes to the URL, keeps other params, and omits defaults', () => {
    const { result } = setup()
    act(() => result.current.params.setPeriod('3mo'))
    act(() => result.current.params.setInterval('1wk'))
    expect(result.current.location.search).toBe('?t=AAPL&period=3mo&interval=1wk')
    act(() => result.current.params.setPeriod('1y'))
    act(() => result.current.params.setInterval('1d'))
    expect(result.current.location.search).toBe('?t=AAPL')
  })

  it('exposes shared indicators from `ind=` and legacy `ov=` links, then clears them', () => {
    const { result } = setup('/charts?t=AAPL&ind=rsi:14,macd')
    expect(result.current.params.sharedIndicators).toEqual(['rsi:14', 'macd'])
    act(() => result.current.params.clearSharedIndicators())
    expect(result.current.location.search).toBe('?t=AAPL')
    expect(result.current.params.sharedIndicators).toBeNull()

    expect(setup('/charts?ov=ema10,bogus,sr').result.current.params.sharedIndicators).toEqual(['ema:10', 'sr'])
    expect(setup('/charts?ov=none').result.current.params.sharedIndicators).toEqual([])
    expect(setup('/charts?ind=RSI;drop').result.current.params.sharedIndicators).toBeNull()
  })

  it('parseSharedIndicators returns null without either param', () => {
    expect(parseSharedIndicators(new URLSearchParams('t=AAPL'))).toBeNull()
  })
})

describe('compare param', () => {
  it('parses, dedupes, normalises and caps at four extra symbols', () => {
    const { result } = setup('/charts?t=AAPL&cmp=msft,MSFT,nvda,googl,amzn,tsla')
    expect(result.current.params.compare).toEqual(['MSFT', 'NVDA', 'GOOGL', 'AMZN'])
  })

  it('toggles and clears', () => {
    const { result } = setup()
    expect(result.current.params.compare).toEqual([])
    act(() => result.current.params.toggleCompare('msft'))
    expect(result.current.location.search).toBe('?t=AAPL&cmp=MSFT')
    act(() => result.current.params.toggleCompare('NVDA'))
    expect(result.current.params.compare).toEqual(['MSFT', 'NVDA'])
    act(() => result.current.params.toggleCompare('MSFT'))
    expect(result.current.params.compare).toEqual(['NVDA'])
    act(() => result.current.params.setCompare([]))
    expect(result.current.location.search).toBe('?t=AAPL')
  })
})
