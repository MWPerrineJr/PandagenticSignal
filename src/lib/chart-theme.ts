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
}

const shared = {
  up: '#10b981',
  down: '#ef4444',
  series: ['#f59e0b', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#e11d48', '#8b5cf6'],
  support: '#10b981',
  resistance: '#ef4444',
}

export const CHART_PALETTES: Record<Theme, ChartPalette> = {
  dark: {
    ...shared,
    background: 'transparent',
    text: '#a1a1aa',
    grid: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.12)',
    crosshair: 'rgba(255,255,255,0.4)',
    volumeUp: 'rgba(16,185,129,0.35)',
    volumeDown: 'rgba(239,68,68,0.35)',
    bandFill: 'rgba(148,163,184,0.10)',
    reference: 'rgba(255,255,255,0.25)',
  },
  light: {
    ...shared,
    background: 'transparent',
    text: '#52525b',
    grid: 'rgba(0,0,0,0.06)',
    border: 'rgba(0,0,0,0.12)',
    crosshair: 'rgba(0,0,0,0.35)',
    volumeUp: 'rgba(16,185,129,0.4)',
    volumeDown: 'rgba(239,68,68,0.4)',
    bandFill: 'rgba(71,85,105,0.10)',
    reference: 'rgba(0,0,0,0.25)',
  },
}

/** Colour for the n-th indicator output on a chart. */
export function seriesColor(palette: ChartPalette, index: number): string {
  return palette.series[index % palette.series.length]!
}
