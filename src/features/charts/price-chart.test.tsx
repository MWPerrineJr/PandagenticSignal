import { act, render, screen } from '@testing-library/react'
import { charts, resetCharts } from '@/test/chart-mock'
import { makeIndicators } from '@/test/fixtures'
import { AppProviders } from '@/app/providers'
import { toChartTime } from '@/lib/chart-data'
import { CHART_PALETTES } from '@/lib/chart-theme'
import { PriceChart, buildLegend, referenceLines } from './price-chart'

vi.mock('lightweight-charts', () => import('@/test/chart-mock'))

beforeEach(resetCharts)

const defaults = makeIndicators('AAPL', 30)

function renderChart(data = defaults) {
  return render(
    <AppProviders>
      <PriceChart data={data} />
    </AppProviders>,
  )
}

describe('PriceChart', () => {
  it('draws candles, volume, one line per overlay output, a band fill and S/R price lines', () => {
    renderChart()
    const chart = charts[0]!
    expect(chart.live('Candlestick')).toHaveLength(1)
    expect(chart.live('Histogram')).toHaveLength(1)
    expect(chart.live('Line')).toHaveLength(4 + 3) // four EMAs + Bollinger middle/upper/lower
    expect(chart.live('Line').every((s) => s.paneIndex === 0)).toBe(true)
    expect(chart.live('Candlestick')[0]!.data).toHaveLength(30)
    expect(chart.live('Candlestick')[0]!.priceLines).toHaveLength(defaults.levels.length)
    expect(chart.live('Candlestick')[0]!.priceLines[0]!.options).toMatchObject({ price: 105, title: 'R ×4' })
    const upper = chart.live('Line').find((s) => s.options.lineStyle === 2 && s.primitives.length)
    expect(upper).toBeDefined()
    expect(chart.paneList).toHaveLength(1)
  })

  it('stacks oscillators in their own panes with reference lines and a MACD histogram', () => {
    renderChart(makeIndicators('AAPL', 30, ['rsi', 'macd', 'sma:50']))
    const chart = charts[0]!
    const rsi = chart.live('Line').filter((s) => s.paneIndex === 1)
    expect(rsi).toHaveLength(1)
    expect(rsi[0]!.priceLines.map((l) => l.options.price)).toEqual([30, 70])
    const macdLines = chart.live('Line').filter((s) => s.paneIndex === 2)
    expect(macdLines).toHaveLength(2)
    expect(chart.live('Histogram').filter((s) => s.paneIndex === 2)).toHaveLength(1)
    expect(macdLines[0]!.priceLines.map((l) => l.options.price)).toEqual([0])
    expect(chart.live('Line').filter((s) => s.paneIndex === 0)).toHaveLength(1) // SMA 50
    expect(chart.paneList).toHaveLength(3)
    expect(chart.paneList[0]!.stretch).toBe(3)
    expect(chart.paneList[1]!.stretch).toBe(1)
  })

  it('rebuilds when the data changes and drops empty panes', () => {
    const { rerender } = renderChart(makeIndicators('AAPL', 30, ['rsi']))
    const chart = charts[0]!
    expect(chart.paneList).toHaveLength(2)
    rerender(
      <AppProviders>
        <PriceChart data={makeIndicators('AAPL', 30, ['ema:10'])} />
      </AppProviders>,
    )
    expect(chart.live('Line')).toHaveLength(1)
    expect(chart.paneList).toHaveLength(1)
    expect(chart.live('Candlestick')[0]!.priceLines).toHaveLength(0)
    rerender(
      <AppProviders>
        <PriceChart data={makeIndicators('AAPL', 30, [])} />
      </AppProviders>,
    )
    expect(chart.live('Line')).toHaveLength(0)
  })

  it('removes the chart on unmount', () => {
    const { unmount } = renderChart()
    unmount()
    expect(charts[0]!.removed).toBe(true)
  })

  it('legend shows the last bar by default and the hovered bar on crosshair move', () => {
    renderChart(makeIndicators('AAPL', 30, ['ema:10']))
    const legend = screen.getByTestId('chart-legend')
    const last = defaults.candles.at(-1)!
    expect(legend).toHaveTextContent(`C$${last.close.toFixed(2)}`)
    act(() => charts[0]!.hover(toChartTime(defaults.candles[3]!.time, '1d')))
    expect(legend).toHaveTextContent(`C$${defaults.candles[3]!.close.toFixed(2)}`)
    act(() => charts[0]!.hover(undefined))
    expect(legend).toHaveTextContent(`C$${last.close.toFixed(2)}`)
  })
})

describe('buildLegend', () => {
  it('lists OHLC, volume and every indicator with a series', () => {
    const items = buildLegend(defaults, -1, CHART_PALETTES.dark)
    expect(items.map((i) => i.label)).toEqual(['O', 'H', 'L', 'C', 'Vol', 'EMA 10', 'EMA 30', 'EMA 60', 'EMA 90', 'BB 20/2'])
    expect(items[0]!.tone).toBe(defaults.candles.at(-1)!.close >= defaults.candles.at(-1)!.open ? 'up' : 'down')
    expect(items.at(-1)!.value).toMatch(/^\$[\d.]+ – \$[\d.]+$/) // lower – upper
  })

  it('formats oscillators as plain numbers and warm-up as a dash', () => {
    const data = makeIndicators('AAPL', 30, ['rsi', 'macd'])
    const items = buildLegend(data, 25, CHART_PALETTES.dark)
    expect(items.find((i) => i.label === 'RSI 14')!.value).toBe('51.00')
    expect(items.find((i) => i.label === 'MACD 12/26/9')!.value).toBe('52.00 / 53.00 / 54.00')
    expect(buildLegend(data, 0, CHART_PALETTES.dark).find((i) => i.label === 'RSI 14')!.value).toBe('—')
  })

  it('returns nothing for empty data', () => {
    expect(buildLegend({ ...defaults, candles: [] }, -1, CHART_PALETTES.dark)).toEqual([])
  })
})

describe('referenceLines', () => {
  it('matches the catalog', () => {
    const at = (id: string) => referenceLines({ id, kind: 'pane', params: {}, outputs: {} })
    expect(at('rsi')).toEqual([30, 70])
    expect(at('willr')).toEqual([-80, -20])
    expect(at('obv')).toEqual([])
  })
})
