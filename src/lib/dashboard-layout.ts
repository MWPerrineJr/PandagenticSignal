/**
 * Dashboard layout model: what gets serialised into `dashboard_layouts.layout` (jsonb) or
 * localStorage. Pure data + zod; no React, no grid library.
 */
import { z } from 'zod'
import { CHART_INTERVALS, CHART_PERIODS } from './use-chart-params'
import { OVERLAY_IDS } from './chart-data'

export const LAYOUT_VERSION = 1 as const
export const GRID_COLS = 12
export const ROW_HEIGHT = 40
export const MAX_WIDGETS = 12

export const WIDGET_TYPES = ['quote', 'chart', 'watchlist', 'analyst', 'compare'] as const
export type WidgetType = (typeof WIDGET_TYPES)[number]
export const isWidgetType = (t: string): t is WidgetType => (WIDGET_TYPES as readonly string[]).includes(t)

/** `null` symbol = follow the ticker selected in the header. */
const symbolOrFollow = z.string().min(1).max(16).nullable().default(null)

export const WIDGET_CONFIG_SCHEMAS = {
  quote: z.object({ symbol: symbolOrFollow }),
  chart: z.object({
    symbol: symbolOrFollow,
    period: z.enum(CHART_PERIODS).default('6mo'),
    interval: z.enum(CHART_INTERVALS).default('1d'),
    overlays: z.array(z.enum(OVERLAY_IDS)).default(['ema10', 'ema30', 'sr']),
  }),
  watchlist: z.object({ limit: z.number().int().min(1).max(20).default(10) }),
  analyst: z.object({ symbol: symbolOrFollow }),
  compare: z.object({
    symbols: z.array(z.string().min(1).max(16)).max(5).default([]),
    period: z.enum(CHART_PERIODS).default('6mo'),
  }),
} as const

export type WidgetConfig<T extends WidgetType = WidgetType> = z.infer<(typeof WIDGET_CONFIG_SCHEMAS)[T]>

export const gridSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
})
export type GridRect = z.infer<typeof gridSchema>

export const widgetSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  config: z.record(z.string(), z.unknown()).default({}),
  grid: gridSchema,
})
export type WidgetInstance = z.infer<typeof widgetSchema>

export const layoutSchema = z.object({
  version: z.literal(LAYOUT_VERSION),
  widgets: z.array(widgetSchema).max(MAX_WIDGETS),
})
export type DashboardLayout = z.infer<typeof layoutSchema>

export interface NamedLayout {
  id: string
  name: string
  isDefault: boolean
  layout: DashboardLayout
  updatedAt: string
}

/** Default size and floor per widget type, in grid units (12 columns × 40 px rows). */
export const WIDGET_SIZES: Record<WidgetType, { w: number; h: number; minW: number; minH: number }> = {
  quote: { w: 4, h: 6, minW: 3, minH: 5 },
  chart: { w: 8, h: 10, minW: 4, minH: 6 },
  watchlist: { w: 4, h: 10, minW: 3, minH: 4 },
  analyst: { w: 8, h: 8, minW: 4, minH: 6 },
  compare: { w: 8, h: 10, minW: 4, minH: 6 },
}

export const WIDGET_TITLES: Record<WidgetType, string> = {
  quote: 'Quote',
  chart: 'Chart',
  watchlist: 'Watchlist',
  analyst: 'Analysts',
  compare: 'Compare',
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `w-${Date.now()}-${Math.random()}`
}

/** Config with defaults filled in; unknown widget types get an empty object. */
export function parseWidgetConfig<T extends WidgetType>(type: T, raw: unknown): WidgetConfig<T>
export function parseWidgetConfig(type: string, raw: unknown): Record<string, unknown>
export function parseWidgetConfig(type: string, raw: unknown) {
  if (!isWidgetType(type)) return {}
  const result = WIDGET_CONFIG_SCHEMAS[type].safeParse(raw ?? {})
  return result.success ? result.data : WIDGET_CONFIG_SCHEMAS[type].parse({})
}

export function starterLayout(): DashboardLayout {
  return {
    version: LAYOUT_VERSION,
    widgets: [
      { id: 'starter-watchlist', type: 'watchlist', config: parseWidgetConfig('watchlist', {}), grid: { x: 0, y: 0, w: 4, h: 10 } },
      { id: 'starter-chart', type: 'chart', config: parseWidgetConfig('chart', {}), grid: { x: 4, y: 0, w: 8, h: 10 } },
      { id: 'starter-quote', type: 'quote', config: parseWidgetConfig('quote', {}), grid: { x: 0, y: 10, w: 4, h: 6 } },
      { id: 'starter-analyst', type: 'analyst', config: parseWidgetConfig('analyst', {}), grid: { x: 4, y: 10, w: 8, h: 8 } },
    ],
  }
}

/**
 * Parse a stored layout. Older versions are migrated here; anything unreadable throws so the
 * caller can fall back to the starter layout rather than rendering garbage.
 */
export function parseLayout(raw: unknown): DashboardLayout {
  const input = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw
  const migrated = migrate(input)
  const parsed = layoutSchema.parse(migrated)
  return { ...parsed, widgets: parsed.widgets.map((w) => ({ ...w, config: parseWidgetConfig(w.type, w.config) })) }
}

function migrate(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input
  const obj = input as Record<string, unknown>
  if (obj.version === undefined && Array.isArray(obj.widgets)) return { ...obj, version: LAYOUT_VERSION }
  return input
}

export function serialiseLayout(layout: DashboardLayout): string {
  return JSON.stringify(layoutSchema.parse(layout))
}

function bottomOf(widgets: WidgetInstance[]): number {
  return widgets.reduce((max, w) => Math.max(max, w.grid.y + w.grid.h), 0)
}

export function addWidget(layout: DashboardLayout, type: WidgetType): DashboardLayout {
  if (layout.widgets.length >= MAX_WIDGETS) return layout
  const size = WIDGET_SIZES[type]
  const widget: WidgetInstance = {
    id: newId(),
    type,
    config: parseWidgetConfig(type, {}),
    grid: { x: 0, y: bottomOf(layout.widgets), w: size.w, h: size.h },
  }
  return { ...layout, widgets: [...layout.widgets, widget] }
}

export function removeWidget(layout: DashboardLayout, id: string): DashboardLayout {
  return { ...layout, widgets: layout.widgets.filter((w) => w.id !== id) }
}

export function updateWidgetConfig(layout: DashboardLayout, id: string, config: Record<string, unknown>): DashboardLayout {
  return {
    ...layout,
    widgets: layout.widgets.map((w) => (w.id === id ? { ...w, config: parseWidgetConfig(w.type, { ...w.config, ...config }) } : w)),
  }
}

/** Apply positions reported by the grid library; ids not in the layout are ignored. */
export function applyGrid(layout: DashboardLayout, rects: ReadonlyArray<{ i: string } & GridRect>): DashboardLayout {
  const byId = new Map(rects.map((r) => [r.i, r]))
  let changed = false
  const widgets = layout.widgets.map((w) => {
    const r = byId.get(w.id)
    if (!r) return w
    if (r.x === w.grid.x && r.y === w.grid.y && r.w === w.grid.w && r.h === w.grid.h) return w
    changed = true
    return { ...w, grid: { x: r.x, y: r.y, w: r.w, h: r.h } }
  })
  return changed ? { ...layout, widgets } : layout
}

export function layoutsEqual(a: DashboardLayout, b: DashboardLayout): boolean {
  return serialiseLayout(a) === serialiseLayout(b)
}
