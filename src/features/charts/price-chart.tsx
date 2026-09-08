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
import type { Indicators } from '@/lib/api'
import {
  EMA_SPANS,
  OVERLAY_LABELS,
  emaSpanOf,
  indexAtTime,
  isIntraday,
  lastValue,
  toCandles,
  toLevelLines,
  toLine,
  toVolume,
  type OverlayId,
} from '@/lib/chart-data'
import { CHART_PALETTES, type ChartPalette } from '@/lib/chart-theme'
import { formatCompact, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface PriceChartProps {
  data: Indicators
  overlays: Set<OverlayId>
  className?: string
  height?: number | string
}

type LineApi = ISeriesApi<'Line'>

interface ChartRefs {
  chart: IChartApi
  candles: ISeriesApi<'Candlestick'>
  volume: ISeriesApi<'Histogram'>
  lines: Map<string, LineApi>
  levels: IPriceLine[]
}

function makeLine(chart: IChartApi, color: string, options: Partial<Parameters<LineApi['applyOptions']>[0]> = {}) {
  return chart.addSeries(LineSeries, {
    color,
    lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
    ...options,
  })
}

/** Candlestick + volume chart with EMA / Bollinger / support-resistance overlays and a legend. */
export function PriceChart({ data, overlays, className, height = 480 }: PriceChartProps) {
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
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, attributionLogo: false },
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
    refs.current = { chart, candles, volume, lines: new Map(), levels: [] }
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

  // Data + overlays.
  useEffect(() => {
    const r = refs.current
    if (!r) return
    const iv = interval
    r.candles.setData(toCandles(data.candles, iv))
    r.volume.setData(toVolume(data.candles, iv, { up: palette.volumeUp, down: palette.volumeDown }))
    r.chart.applyOptions({ timeScale: { timeVisible: isIntraday(iv), secondsVisible: false } })

    const wanted = new Map<string, { color: string; values: Array<number | null>; style?: LineStyle }>()
    for (const span of EMA_SPANS) {
      if (overlays.has(`ema${span}`)) wanted.set(`ema${span}`, { color: palette.ema[span], values: data.ema[span] ?? [] })
    }
    if (overlays.has('bb')) {
      wanted.set('bb-upper', { color: palette.bollinger, values: data.bollinger.upper, style: LineStyle.Dashed })
      wanted.set('bb-lower', { color: palette.bollinger, values: data.bollinger.lower, style: LineStyle.Dashed })
      wanted.set('bb-middle', { color: palette.bollingerMiddle, values: data.bollinger.middle, style: LineStyle.Dotted })
    }
    for (const [key, series] of r.lines) {
      if (!wanted.has(key)) {
        r.chart.removeSeries(series)
        r.lines.delete(key)
      }
    }
    for (const [key, spec] of wanted) {
      let series = r.lines.get(key)
      if (!series) {
        series = makeLine(r.chart, spec.color, { lineStyle: spec.style ?? LineStyle.Solid })
        r.lines.set(key, series)
      } else {
        series.applyOptions({ color: spec.color, lineStyle: spec.style ?? LineStyle.Solid })
      }
      series.setData(toLine(data.candles, spec.values, iv))
    }

    for (const line of r.levels) r.candles.removePriceLine(line)
    r.levels = overlays.has('sr')
      ? toLevelLines(data.levels).map((lv) =>
          r.candles.createPriceLine({
            price: lv.price,
            title: lv.title,
            color: lv.kind === 'support' ? palette.support : palette.resistance,
            lineWidth: 1,
            lineStyle: LineStyle.LargeDashed,
            axisLabelVisible: true,
          }),
        )
      : []

    r.chart.timeScale().fitContent()
  }, [data, overlays, palette, interval])

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

  const legend = useMemo(() => buildLegend(data, overlays, hoverIndex, palette), [data, overlays, hoverIndex, palette])

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

export function buildLegend(
  data: Indicators,
  overlays: Set<OverlayId>,
  hoverIndex: number,
  palette: ChartPalette,
): LegendItem[] {
  const idx = hoverIndex >= 0 ? hoverIndex : data.candles.length - 1
  const candle = data.candles[idx]
  if (!candle) return []
  const at = (values: Array<number | null> | undefined) =>
    hoverIndex >= 0 ? (values?.[idx] ?? null) : lastValue(values)
  const tone = candle.close >= candle.open ? 'up' : 'down'
  const items: LegendItem[] = [
    { label: 'O', value: formatPrice(candle.open), tone },
    { label: 'H', value: formatPrice(candle.high), tone },
    { label: 'L', value: formatPrice(candle.low), tone },
    { label: 'C', value: formatPrice(candle.close), tone },
    { label: 'Vol', value: formatCompact(candle.volume) },
  ]
  for (const id of overlays) {
    const span = emaSpanOf(id)
    if (span) items.push({ label: OVERLAY_LABELS[id], value: formatPrice(at(data.ema[span])), color: palette.ema[span] })
  }
  if (overlays.has('bb')) {
    items.push({
      label: 'BB',
      value: `${formatPrice(at(data.bollinger.lower))} – ${formatPrice(at(data.bollinger.upper))}`,
      color: palette.bollinger,
    })
  }
  return items
}
