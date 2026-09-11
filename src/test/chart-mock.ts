/**
 * In-memory stand-in for lightweight-charts. Records every series, price line and option
 * call so tests can assert what the chart component asked for without a canvas.
 */
import { vi } from 'vitest'

export interface FakeSeries {
  kind: string
  options: Record<string, unknown>
  data: unknown[]
  priceLines: FakePriceLine[]
  paneIndex: number
  primitives: unknown[]
  removed: boolean
  setData: ReturnType<typeof vi.fn>
  applyOptions: ReturnType<typeof vi.fn>
  createPriceLine: ReturnType<typeof vi.fn>
  removePriceLine: ReturnType<typeof vi.fn>
  attachPrimitive: ReturnType<typeof vi.fn>
}
export interface FakePriceLine {
  options: Record<string, unknown>
  removed: boolean
}
export interface FakePane {
  stretch: number
  setStretchFactor: ReturnType<typeof vi.fn>
  setHeight: ReturnType<typeof vi.fn>
}
export interface FakeChart {
  series: FakeSeries[]
  paneList: FakePane[]
  panes: ReturnType<typeof vi.fn>
  removePane: ReturnType<typeof vi.fn>
  options: Record<string, unknown>[]
  crosshairHandlers: Set<(p: unknown) => void>
  removed: boolean
  addSeries: ReturnType<typeof vi.fn>
  removeSeries: ReturnType<typeof vi.fn>
  applyOptions: ReturnType<typeof vi.fn>
  priceScale: ReturnType<typeof vi.fn>
  timeScale: ReturnType<typeof vi.fn>
  subscribeCrosshairMove: ReturnType<typeof vi.fn>
  unsubscribeCrosshairMove: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  /** Simulate the crosshair moving to `time` (undefined = leaves the chart). */
  hover: (time: unknown) => void
  live: (kind?: string) => FakeSeries[]
}

export const charts: FakeChart[] = []

function makeSeries(kind: string, options: Record<string, unknown>, paneIndex: number): FakeSeries {
  const s: FakeSeries = {
    kind,
    options: { ...options },
    data: [],
    priceLines: [],
    paneIndex,
    primitives: [],
    removed: false,
    attachPrimitive: vi.fn((p: unknown) => {
      s.primitives.push(p)
    }),
    setData: vi.fn((data: unknown[]) => {
      s.data = data
    }),
    applyOptions: vi.fn((o: Record<string, unknown>) => Object.assign(s.options, o)),
    createPriceLine: vi.fn((o: Record<string, unknown>) => {
      const line: FakePriceLine = { options: o, removed: false }
      s.priceLines.push(line)
      return line
    }),
    removePriceLine: vi.fn((line: FakePriceLine) => {
      line.removed = true
      s.priceLines = s.priceLines.filter((l) => l !== line)
    }),
  }
  return s
}

function makePane(): FakePane {
  const p: FakePane = {
    stretch: 1,
    setStretchFactor: vi.fn((f: number) => {
      p.stretch = f
    }),
    setHeight: vi.fn(),
  }
  return p
}

export function createChart(): FakeChart {
  const chart: FakeChart = {
    series: [],
    paneList: [makePane()],
    options: [],
    crosshairHandlers: new Set(),
    removed: false,
    addSeries: vi.fn((def: { type: string }, options: Record<string, unknown> = {}, paneIndex = 0) => {
      while (chart.paneList.length <= paneIndex) chart.paneList.push(makePane())
      const s = makeSeries(def.type, options, paneIndex)
      chart.series.push(s)
      return s
    }),
    panes: vi.fn(() => chart.paneList),
    removePane: vi.fn((index: number) => {
      chart.paneList.splice(index, 1)
    }),
    removeSeries: vi.fn((s: FakeSeries) => {
      s.removed = true
    }),
    applyOptions: vi.fn((o: Record<string, unknown>) => chart.options.push(o)),
    priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
    timeScale: vi.fn(() => ({ fitContent: vi.fn(), applyOptions: vi.fn() })),
    subscribeCrosshairMove: vi.fn((h: (p: unknown) => void) => chart.crosshairHandlers.add(h)),
    unsubscribeCrosshairMove: vi.fn((h: (p: unknown) => void) => chart.crosshairHandlers.delete(h)),
    remove: vi.fn(() => {
      chart.removed = true
    }),
    hover: (time) => {
      for (const h of chart.crosshairHandlers) h({ time, seriesData: new Map() })
    },
    live: (kind) => chart.series.filter((s) => !s.removed && (kind === undefined || s.kind === kind)),
  }
  charts.push(chart)
  return chart
}

export const CandlestickSeries = { type: 'Candlestick' }
export const LineSeries = { type: 'Line' }
export const HistogramSeries = { type: 'Histogram' }
export const ColorType = { Solid: 'solid' }
export const CrosshairMode = { Normal: 0, Magnet: 1 }
export const LineStyle = { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3 }

export function resetCharts() {
  charts.length = 0
}
