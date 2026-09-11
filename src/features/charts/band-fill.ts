/**
 * Translucent fill between two line series (Bollinger, Keltner, Donchian, the Ichimoku cloud).
 * A lightweight-charts series primitive: it attaches to the upper line and reads both lines'
 * data, so it needs no data of its own and follows the chart's scales on every redraw.
 */
import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  LineData,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts'

type LineApi = ISeriesApi<'Line'>

interface Point {
  x: number
  y: number
}

export class BandFill implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null
  private upper: LineApi | null = null
  private polygon: Point[] = []
  private readonly view: IPrimitivePaneView
  private readonly lower: LineApi
  private readonly color: string

  constructor(lower: LineApi, color: string) {
    this.lower = lower
    this.color = color
    this.view = {
      zOrder: () => 'bottom',
      renderer: (): IPrimitivePaneRenderer | null =>
        this.polygon.length < 3
          ? null
          : {
              draw: (target) => {
                target.useMediaCoordinateSpace(({ context }) => {
                  context.beginPath()
                  for (const [i, p] of this.polygon.entries()) {
                    if (i === 0) context.moveTo(p.x, p.y)
                    else context.lineTo(p.x, p.y)
                  }
                  context.closePath()
                  context.fillStyle = this.color
                  context.fill()
                })
              },
            },
    }
  }

  attached({ chart, series }: SeriesAttachedParameter<Time, 'Line'>): void {
    this.chart = chart
    this.upper = series
  }

  detached(): void {
    this.chart = null
    this.upper = null
    this.polygon = []
  }

  updateAllViews(): void {
    const chart = this.chart
    const upper = this.upper
    if (!chart || !upper) return
    const timeScale = chart.timeScale()
    const top: Point[] = []
    const bottom: Point[] = []
    const lowerByTime = new Map<string, number>()
    for (const d of this.lower.data() as LineData<Time>[]) lowerByTime.set(String(d.time), d.value)
    for (const d of upper.data() as LineData<Time>[]) {
      const lo = lowerByTime.get(String(d.time))
      if (lo === undefined) continue
      const x = timeScale.timeToCoordinate(d.time)
      const yTop = upper.priceToCoordinate(d.value)
      const yBottom = upper.priceToCoordinate(lo)
      if (x === null || yTop === null || yBottom === null) continue
      top.push({ x, y: yTop })
      bottom.push({ x, y: yBottom })
    }
    this.polygon = [...top, ...bottom.reverse()]
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view]
  }
}
