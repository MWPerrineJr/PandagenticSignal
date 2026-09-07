import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
} from 'lightweight-charts'
import { useTheme } from '@/components/theme-provider'
import { CHART_PALETTES } from '@/lib/chart-theme'
import { VIZ_PALETTES } from '@/lib/viz-palette'
import { formatPct, type NormalisedSeries } from '@/lib/compare'
import { isIntraday } from '@/lib/chart-data'
import { cn } from '@/lib/utils'

export interface CompareChartProps {
  series: NormalisedSeries[]
  interval: string
  className?: string
  height?: number
}

/** Normalised % change lines, one categorical hue per symbol in fixed order, zero baseline. */
export function CompareChart({ series, interval, className, height = 480 }: CompareChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const linesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())
  const { theme } = useTheme()
  const palette = CHART_PALETTES[theme]
  const viz = VIZ_PALETTES[theme]
  const [hover, setHover] = useState<Map<string, number> | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, attributionLogo: false },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 4 },
      localization: { priceFormatter: (v: number) => formatPct(v, 1) },
    })
    chartRef.current = chart
    const lines = linesRef.current
    return () => {
      chart.remove()
      chartRef.current = null
      lines.clear()
    }
  }, [])

  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: { textColor: palette.text },
      grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
      crosshair: {
        vertLine: { color: palette.crosshair, labelBackgroundColor: palette.text },
        horzLine: { color: palette.crosshair, labelBackgroundColor: palette.text },
      },
    })
  }, [palette])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const lines = linesRef.current
    const wanted = new Set(series.map((s) => s.symbol))
    for (const [symbol, line] of lines) {
      if (!wanted.has(symbol)) {
        chart.removeSeries(line)
        lines.delete(symbol)
      }
    }
    series.forEach((s, i) => {
      const color = viz.categorical[i % viz.categorical.length]!
      let line = lines.get(s.symbol)
      if (!line) {
        line = chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          title: s.symbol,
        })
        lines.set(s.symbol, line)
      } else {
        line.applyOptions({ color })
      }
      line.setData(s.points)
      if (i === 0) {
        line.createPriceLine({ price: 0, color: palette.border, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: false, title: '' })
      }
    })
    chart.applyOptions({ timeScale: { timeVisible: isIntraday(interval), secondsVisible: false } })
    chart.timeScale().fitContent()
  }, [series, viz, palette, interval])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const handler = (params: MouseEventParams) => {
      if (params.time === undefined) {
        setHover(null)
        return
      }
      const next = new Map<string, number>()
      for (const [symbol, line] of linesRef.current) {
        const point = params.seriesData.get(line) as { value?: number } | undefined
        if (point?.value !== undefined) next.set(symbol, point.value)
      }
      setHover(next)
    }
    chart.subscribeCrosshairMove(handler)
    return () => chart.unsubscribeCrosshairMove(handler)
  }, [])

  const legend = useMemo(
    () =>
      series.map((s, i) => ({
        symbol: s.symbol,
        color: viz.categorical[i % viz.categorical.length]!,
        value: hover ? (hover.get(s.symbol) ?? null) : s.last,
      })),
    [series, viz, hover],
  )

  return (
    <div className={cn('relative', className)} style={{ height }} data-testid="compare-chart">
      <div ref={containerRef} className="absolute inset-0" />
      <ul
        className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-background/70 px-2 py-1 text-xs tabular-nums backdrop-blur"
        aria-label="Compared symbols"
        data-testid="compare-legend"
      >
        {legend.map((item) => (
          <li key={item.symbol} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: item.color }} aria-hidden />
            <span className="font-mono text-muted-foreground">{item.symbol}</span>
            <span className={item.value == null ? undefined : item.value >= 0 ? 'text-emerald-500' : 'text-red-500'}>
              {formatPct(item.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
