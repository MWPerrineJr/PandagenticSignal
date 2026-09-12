import type { Theme } from '@/components/theme-provider'

export interface ChartPalette {
  background: string
  text: string
  grid: string
  border: string
  crosshair: string
  up: string
  down: string
  volumeUp: string
  volumeDown: string
  /** Line colours handed out to indicator outputs in order. */
  series: readonly string[]
  bandFill: string
  reference: string
  support: string
  resistance: string
  fib: string
}

/* Brand colours mirror pandagentic.ai (primary #00ff40 on near-black, destructive #dc2828).
 * Up/support share the brand green and down/resistance share the brand red — status colours,
 * reused across the up/down and support/resistance pairs as this chart already did before the
 * rebrand, never doubling as a categorical indicator-line colour. */
const shared = {
  up: '#00ff40',
  down: '#dc2828',
  series: ['#f59e0b', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#06b6d4', '#64748b', '#8b5cf6'],
  support: '#00ff40',
  resistance: '#dc2828',
  fib: '#eab308',
}

export const CHART_PALETTES: Record<Theme, ChartPalette> = {
  dark: {
    ...shared,
    background: 'transparent',
    text: '#a5b6ab',
    grid: 'rgba(190,255,210,0.05)',
    border: '#1f3325',
    crosshair: 'rgba(150,255,180,0.45)',
    volumeUp: 'rgba(0,255,64,0.35)',
    volumeDown: 'rgba(220,40,40,0.35)',
    bandFill: 'rgba(150,200,175,0.08)',
    reference: 'rgba(165,214,180,0.3)',
  },
  light: {
    ...shared,
    background: 'transparent',
    text: '#55655c',
    grid: 'rgba(10,40,25,0.06)',
    border: '#dbe7df',
    crosshair: 'rgba(19,174,97,0.4)',
    volumeUp: 'rgba(15,158,87,0.45)',
    volumeDown: 'rgba(200,30,30,0.45)',
    bandFill: 'rgba(80,120,100,0.08)',
    reference: 'rgba(20,50,35,0.25)',
  },
}

/** Colour for the n-th indicator output on a chart. */
export function seriesColor(palette: ChartPalette, index: number): string {
  return palette.series[index % palette.series.length]!
}
