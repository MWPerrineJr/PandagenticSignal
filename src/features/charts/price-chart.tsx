import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
} from 'lightweight-charts'
import { useTheme } from '@/components/theme-provider'
import type { IndicatorSeries, Indicators } from '@/lib/api'
import { indexAtTime, isIntraday, lastValue, toCandles, toLevelLines, toLine, toVolume } from '@/lib/chart-data'
import { CHART_PALETTES, seriesColor, type ChartPalette } from '@/lib/chart-theme'
import { tokenLabel } from '@/lib/indicators'
import { formatCompact, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BandFill } from './band-fill'

export interface PriceChartProps {
  /** Candles plus whatever indicator series the API returned; the chart draws all of them. */
  data: Indicators
  className?: string
  height?: number | string
}

type LineApi = ISeriesApi<'Line'>
type HistApi = ISeriesApi<'Histogram'>

interface ChartRefs {
  chart: IChartApi
  candles: ISeriesApi<'Candlestick'>
  volume: ISeriesApi<'Histogram'>
  drawn: Array<LineApi | HistApi>
  levels: IPriceLine[]
}

/** Outputs that form a channel; the first is filled down to the second. */
const BAND_PAIRS: Array<[string, string]> = [
  ['upper', 'lower'],
  ['senkou_a', 'senkou_b'],
]
const DASHED = new Set(['upper', 'lower', 'r1', 'r2', 's1', 's2', 'senkou_a', 'senkou_b'])
const DOTTED = new Set(['middle', 'chikou', 'signal', 'd', 'plus_di', 'minus_di'])
const MAIN_PANE_WEIGHT = 3

/** Candlestick + volume chart; overlays share the price pane, oscillators stack below it. */
export function PriceChart({ data, className, height = 480 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const refs = useRef<ChartRefs | null>(null)
  const { theme } = useTheme()
  const palette = CHART_PALETTES[theme]
  const [hoverIndex, setHoverIndex] = useState<number>(-1)
  const interval = data.interval

  // Create the chart once per mount.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        attributionLogo: false,
        panes: { separatorColor: 'rgba(128,128,128,0.25)', separatorHoverColor: 'rgba(128,128,128,0.4)', enableResize: true },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 4 },
    })
    const candles = chart.addSeries(CandlestickSeries, { priceLineVisible: false })
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      priceLineVisible: false,
      lastValueVisible: false,
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    refs.current = { chart, candles, volume, drawn: [], levels: [] }
    return () => {
      chart.remove()
      refs.current = null
    }
  }, [])

  // Theme colours.
  useEffect(() => {
    const r = refs.current
    if (!r) return
    applyPalette(r, palette)
  }, [palette])

  // Data + indicators: rebuilt from scratch whenever the response changes (cheap, no diffing bugs).
  useEffect(() => {
    const r = refs.current
    if (!r) return
    const iv = interval
    r.candles.setData(toCandles(data.candles, iv))
    r.volume.setData(toVolume(data.candles, iv, { up: palette.volumeUp, down: palette.volumeDown }))
    r.chart.applyOptions({ timeScale: { timeVisible: isIntraday(iv), secondsVisible: false } })

    for (const s of r.drawn) r.chart.removeSeries(s)
    r.drawn = []
    for (const line of r.levels) r.candles.removePriceLine(line)
    r.levels = []
    // Drop the oscillator panes left behind; pane 0 is the price pane.
    const panes = r.chart.panes()
    for (let i = panes.length - 1; i >= 1; i--) r.chart.removePane(i)

    let pane = 0
    let colorIndex = 0
    for (const [token, series] of Object.entries(data.series)) {
      const paneIndex = series.kind === 'pane' ? ++pane : 0
      const label = tokenLabel(token)
      const byOutput = new Map<string, LineApi>()
      let first: LineApi | HistApi | null = null
      for (const [output, values] of Object.entries(series.outputs)) {
        const color = seriesColor(palette, colorIndex++)
        const points = toLine(data.candles, values, iv)
        if (output === 'hist') {
          const hist = r.chart.addSeries(
            HistogramSeries,
            { color, priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'price', precision: 2, minMove: 0.01 } },
            paneIndex,
          )
          hist.setData(points.map((p) => ({ ...p, color: p.value >= 0 ? palette.up : palette.down })))
          r.drawn.push(hist)
          first ??= hist
          continue
        }
        const line = r.chart.addSeries(
          LineSeries,
          {
            color,
            lineWidth: 1,
            lineStyle: DASHED.has(output) ? LineStyle.Dashed : DOTTED.has(output) ? LineStyle.Dotted : LineStyle.Solid,
            lineVisible: series.id !== 'psar',
            pointMarkersVisible: series.id === 'psar',
            pointMarkersRadius: 1.5,
            priceLineVisible: false,
            lastValueVisible: series.kind === 'pane' && Object.keys(series.outputs).length === 1,
            crosshairMarkerVisible: false,
            title: series.kind === 'pane' ? `${label}${Object.keys(series.outputs).length > 1 ? ` ${output}` : ''}` : '',
          },
          paneIndex,
        )
        line.setData(points)
        r.drawn.push(line)
        byOutput.set(output, line)
        first ??= line
      }
      for (const [upper, lower] of BAND_PAIRS) {
        const u = byOutput.get(upper)
        const l = byOutput.get(lower)
        if (u && l) u.attachPrimitive(new BandFill(l, palette.bandFill))
      }
      if (series.kind === 'pane' && first) {
        for (const value of referenceLines(series)) {
          first.createPriceLine({
            price: value,
            color: palette.reference,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: false,
            title: '',
          })
        }
      }
    }
    const all = r.chart.panes()
    all[0]?.setStretchFactor(MAIN_PANE_WEIGHT)
    for (const p of all.slice(1)) p.setStretchFactor(1)

    r.levels = toLevelLines(data.levels).map((lv) =>
      r.candles.createPriceLine({
        price: lv.price,
        title: lv.title,
        color: lv.kind === 'fib' ? palette.fib : lv.kind === 'support' ? palette.support : palette.resistance,
        lineWidth: 1,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
      }),
    )

    r.chart.timeScale().fitContent()
  }, [data, palette, interval])

  // Crosshair → legend.
  useEffect(() => {
    const r = refs.current
    if (!r) return
    const handler = (params: MouseEventParams) => {
      setHoverIndex(params.time === undefined ? -1 : indexAtTime(data, interval, params.time))
    }
    r.chart.subscribeCrosshairMove(handler)
    return () => r.chart.unsubscribeCrosshairMove(handler)
  }, [data, interval])

  const legend = useMemo(() => buildLegend(data, hoverIndex, palette), [data, hoverIndex, palette])

  return (
    <div className={cn('relative', className)} style={{ height }} data-testid="price-chart">
      <div ref={containerRef} className="absolute inset-0" />
      <div
        className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-background/70 px-2 py-1 text-xs tabular-nums backdrop-blur"
        aria-live="polite"
        data-testid="chart-legend"
      >
        {legend.map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            {item.color && <span className="inline-block size-2 rounded-full" style={{ background: item.color }} aria-hidden />}
            <span className="text-muted-foreground">{item.label}</span>
            <span className={item.tone === 'up' ? 'text-emerald-500' : item.tone === 'down' ? 'text-red-500' : undefined}>
              {item.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Reference levels per oscillator (mirrors the API catalog so the chart needs no extra fetch). */
export function referenceLines(series: IndicatorSeries): number[] {
  switch (series.id) {
    case 'rsi':
      return [30, 70]
    case 'stoch':
    case 'mfi':
      return [20, 80]
    case 'willr':
      return [-80, -20]
    case 'cci':
      return [-100, 100]
    case 'adx':
      return [25]
    case 'macd':
    case 'roc':
      return [0]
    default:
      return []
  }
}

function applyPalette(r: ChartRefs, p: ChartPalette) {
  r.chart.applyOptions({
    layout: { textColor: p.text },
    grid: { vertLines: { color: p.grid }, horzLines: { color: p.grid } },
    crosshair: {
      vertLine: { color: p.crosshair, labelBackgroundColor: p.text },
      horzLine: { color: p.crosshair, labelBackgroundColor: p.text },
    },
  })
  r.candles.applyOptions({
    upColor: p.up,
    downColor: p.down,
    wickUpColor: p.up,
    wickDownColor: p.down,
    borderVisible: false,
  })
}

interface LegendItem {
  label: string
  value: string
  color?: string
  tone?: 'up' | 'down'
}

function formatIndicatorValue(v: number | null, kind: IndicatorSeries['kind']): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (kind === 'overlay') return formatPrice(v)
  return Math.abs(v) >= 100_000 ? formatCompact(v) : v.toFixed(2)
}

export function buildLegend(data: Indicators, hoverIndex: number, palette: ChartPalette): LegendItem[] {
  const idx = hoverIndex >= 0 ? hoverIndex : data.candles.length - 1
  const candle = data.candles[idx]
  if (!candle) return []
  const at = (values: Array<number | null>) => (hoverIndex >= 0 ? (values[idx] ?? null) : lastValue(values))
  const tone = candle.close >= candle.open ? 'up' : 'down'
  const items: LegendItem[] = [
    { label: 'O', value: formatPrice(candle.open), tone },
    { label: 'H', value: formatPrice(candle.high), tone },
    { label: 'L', value: formatPrice(candle.low), tone },
    { label: 'C', value: formatPrice(candle.close), tone },
    { label: 'Vol', value: formatCompact(candle.volume) },
  ]
  let colorIndex = 0
  for (const [token, series] of Object.entries(data.series)) {
    const outputs = Object.entries(series.outputs)
    const color = seriesColor(palette, colorIndex)
    colorIndex += outputs.length
    if (outputs.length === 0) continue // support/resistance has no series
    const upper = series.outputs.upper
    const lower = series.outputs.lower
    const value =
      upper && lower
        ? `${formatIndicatorValue(at(lower), series.kind)} – ${formatIndicatorValue(at(upper), series.kind)}`
        : outputs
            .slice(0, 3)
            .map(([, values]) => formatIndicatorValue(at(values), series.kind))
            .join(' / ')
    items.push({ label: tokenLabel(token), value, color })
  }
  return items
}
