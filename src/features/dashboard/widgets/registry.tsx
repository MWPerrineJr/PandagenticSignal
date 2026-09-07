import { lazy, type ComponentType } from 'react'
import { isWidgetType, WIDGET_SIZES, WIDGET_TITLES, WIDGET_TYPES, type WidgetConfig, type WidgetType } from '@/lib/dashboard-layout'
import { QuoteWidget, QuoteWidgetSettings } from './quote-widget'
import { WatchlistWidget, WatchlistWidgetSettings } from './watchlist-widget'
import { AnalystWidget, AnalystWidgetSettings } from './analyst-widget'

// Chart-based widgets pull in lightweight-charts; load them on demand so the dashboard route
// (the index page) does not carry the chart library in the main bundle.
const ChartWidget = lazy(() => import('./chart-widget').then((m) => ({ default: m.ChartWidget })))
const ChartWidgetSettings = lazy(() => import('./chart-widget').then((m) => ({ default: m.ChartWidgetSettings })))
const CompareWidget = lazy(() => import('./compare-widget').then((m) => ({ default: m.CompareWidget })))
const CompareWidgetSettings = lazy(() => import('./compare-widget').then((m) => ({ default: m.CompareWidgetSettings })))

export interface WidgetProps<T extends WidgetType = WidgetType> {
  config: WidgetConfig<T>
  /** Ticker selected in the header, used when the widget's own symbol is blank. */
  activeTicker: string | null
  editing: boolean
}

export interface WidgetSettingsProps<T extends WidgetType = WidgetType> {
  config: WidgetConfig<T>
  onChange: (patch: Partial<WidgetConfig<T>>) => void
}

export interface WidgetDefinition<T extends WidgetType = WidgetType> {
  type: T
  title: string
  description: string
  size: (typeof WIDGET_SIZES)[T]
  Component: ComponentType<WidgetProps<T>>
  Settings: ComponentType<WidgetSettingsProps<T>>
  /** Subtitle shown in the title bar, e.g. the resolved symbol. */
  subtitle?: (config: WidgetConfig<T>, activeTicker: string | null) => string | undefined
}

const followOr = (symbol: string | null, active: string | null) => symbol ?? active ?? undefined

export const WIDGET_REGISTRY: { [T in WidgetType]: WidgetDefinition<T> } = {
  quote: {
    type: 'quote',
    title: WIDGET_TITLES.quote,
    description: 'Price, change and ranges for one symbol',
    size: WIDGET_SIZES.quote,
    Component: QuoteWidget,
    Settings: QuoteWidgetSettings,
    subtitle: (c, a) => followOr(c.symbol, a),
  },
  chart: {
    type: 'chart',
    title: WIDGET_TITLES.chart,
    description: 'Candlesticks with indicator overlays',
    size: WIDGET_SIZES.chart,
    Component: ChartWidget,
    Settings: ChartWidgetSettings,
    subtitle: (c, a) => followOr(c.symbol, a),
  },
  watchlist: {
    type: 'watchlist',
    title: WIDGET_TITLES.watchlist,
    description: 'Your tracked symbols with live quotes',
    size: WIDGET_SIZES.watchlist,
    Component: WatchlistWidget,
    Settings: WatchlistWidgetSettings,
  },
  analyst: {
    type: 'analyst',
    title: WIDGET_TITLES.analyst,
    description: 'Consensus rating and price targets',
    size: WIDGET_SIZES.analyst,
    Component: AnalystWidget,
    Settings: AnalystWidgetSettings,
    subtitle: (c, a) => followOr(c.symbol, a),
  },
  compare: {
    type: 'compare',
    title: WIDGET_TITLES.compare,
    description: 'Normalised % change for several symbols',
    size: WIDGET_SIZES.compare,
    Component: CompareWidget,
    Settings: CompareWidgetSettings,
    subtitle: (c) => (c.symbols.length ? c.symbols.join(' · ') : 'tracked symbols'),
  },
}

export function resolveWidget(type: string): WidgetDefinition | null {
  return isWidgetType(type) ? (WIDGET_REGISTRY[type] as WidgetDefinition) : null
}

export const WIDGET_MENU = WIDGET_TYPES.map((t) => WIDGET_REGISTRY[t])
