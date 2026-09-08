import { act, render, screen } from '@testing-library/react'
import { charts, resetCharts } from '@/test/chart-mock'
import { makeIndicators } from '@/test/fixtures'
import { AppProviders } from '@/app/providers'
import { OVERLAY_IDS, toChartTime, type OverlayId } from '@/lib/chart-data'
import { CHART_PALETTES } from '@/lib/chart-theme'
import { PriceChart, buildLegend } from './price-chart'

vi.mock('lightweight-charts', () => import('@/test/chart-mock'))

beforeEach(resetCharts)

const data = makeIndicators('AAPL', 30)
const all = new Set<OverlayId>(OVERLAY_IDS)

function renderChart(overlays: Set<OverlayId>) {
  return render(
    <AppProviders>
      <PriceChart data={data} overlays={overlays} />
    </AppProviders>,
  )
}

describe('PriceChart', () => {
  it('creates candles, volume, one line per EMA, three Bollinger lines and S/R price lines', () => {
    renderChart(all)
    const chart = charts[0]!
    expect(chart.live('Candlestick')).toHaveLength(1)
    expect(chart.live('Histogram')).toHaveLength(1)
    expect(chart.live('Line')).toHaveLength(4 + 3)
    expect(chart.live('Candlestick')[0]!.data).toHaveLength(30)
    expect(chart.live('Candlestick')[0]!.priceLines).toHaveLength(data.levels.length)
    expect(chart.live('Candlestick')[0]!.priceLines[0]!.options).toMatchObject({ price: 105, title: 'R ×4' })
  })

  it('adds and removes overlays when toggles change', () => {
    const { rerender } = renderChart(new Set(['ema10']))
    const chart = charts[0]!
    expect(chart.live('Line')).toHaveLength(1)
    expect(chart.live('Candlestick')[0]!.priceLines).toHaveLength(0)

    rerender(
      <AppProviders>
        <PriceChart data={data} overlays={new Set(['ema10', 'bb', 'sr'])} />
      </AppProviders>,
    )
    expect(chart.live('Line')).toHaveLength(4)
    expect(chart.live('Candlestick')[0]!.priceLines).toHaveLength(2)

    rerender(
      <AppProviders>
        <PriceChart data={data} overlays={new Set()} />
      </AppProviders>,
    )
    expect(chart.live('Line')).toHaveLength(0)
    expect(chart.live('Candlestick')[0]!.priceLines).toHaveLength(0)
  })

  it('removes the chart on unmount', () => {
    const { unmount } = renderChart(all)
    unmount()
    expect(charts[0]!.removed).toBe(true)
  })

  it('legend shows the last bar by default and the hovered bar on crosshair move', () => {
    renderChart(new Set(['ema10']))
    const legend = screen.getByTestId('chart-legend')
    const last = data.candles.at(-1)!
    expect(legend).toHaveTextContent(`C$${last.close.toFixed(2)}`)
    act(() => charts[0]!.hover(toChartTime(data.candles[3]!.time, '1d')))
    expect(legend).toHaveTextContent(`C$${data.candles[3]!.close.toFixed(2)}`)
    act(() => charts[0]!.hover(undefined))
    expect(legend).toHaveTextContent(`C$${last.close.toFixed(2)}`)
  })
})

describe('buildLegend', () => {
  it('lists OHLC, volume and enabled overlays', () => {
    const items = buildLegend(data, all, -1, CHART_PALETTES.dark)
    expect(items.map((i) => i.label)).toEqual(['O', 'H', 'L', 'C', 'Vol', 'EMA 10', 'EMA 30', 'EMA 60', 'EMA 90', 'BB'])
    expect(items[0]!.tone).toBe(data.candles.at(-1)!.close >= data.candles.at(-1)!.open ? 'up' : 'down')
  })

  it('shows warm-up values as a dash when hovering an early bar', () => {
    const items = buildLegend(data, new Set(['bb']), 0, CHART_PALETTES.dark)
    expect(items.at(-1)!.value).toBe('— – —')
  })

  it('returns nothing for empty data', () => {
    expect(buildLegend({ ...data, candles: [] }, all, -1, CHART_PALETTES.dark)).toEqual([])
  })
})
