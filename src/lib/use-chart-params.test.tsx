import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { OVERLAY_IDS } from './chart-data'
import { parseOverlays, serialiseOverlays, useChartParams } from './use-chart-params'

function wrapperFor(route: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
}

function setup(route = '/charts?t=AAPL') {
  return renderHook(() => ({ params: useChartParams(), location: useLocation() }), { wrapper: wrapperFor(route) })
}

describe('useChartParams', () => {
  it('defaults to 1y daily with every overlay on', () => {
    const { result } = setup()
    expect(result.current.params.period).toBe('1y')
    expect(result.current.params.interval).toBe('1d')
    expect([...result.current.params.overlays]).toEqual([...OVERLAY_IDS])
  })

  it('reads values from the URL and ignores invalid ones', () => {
    const { result } = setup('/charts?period=6mo&interval=1wk&ov=ema10,bogus,sr')
    expect(result.current.params.period).toBe('6mo')
    expect(result.current.params.interval).toBe('1wk')
    expect([...result.current.params.overlays]).toEqual(['ema10', 'sr'])
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

  it('toggles overlays with a compact representation', () => {
    const { result } = setup()
    act(() => result.current.params.toggleOverlay('bb'))
    expect(result.current.location.search).toBe('?t=AAPL&ov=ema10%2Cema30%2Cema60%2Cema90%2Csr')
    expect(result.current.params.overlays.has('bb')).toBe(false)
    act(() => result.current.params.toggleOverlay('bb'))
    expect(result.current.location.search).toBe('?t=AAPL')
    for (const id of OVERLAY_IDS) act(() => result.current.params.toggleOverlay(id))
    expect(result.current.location.search).toBe('?t=AAPL&ov=none')
    expect(result.current.params.overlays.size).toBe(0)
  })

  it('parse/serialise round-trip', () => {
    expect(serialiseOverlays(parseOverlays(null))).toBeNull()
    expect(serialiseOverlays(parseOverlays('none'))).toBe('none')
    expect(serialiseOverlays(parseOverlays('sr,ema10'))).toBe('ema10,sr')
  })
})
