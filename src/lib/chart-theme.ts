import type { Theme } from '@/components/theme-provider'
import type { EmaSpan } from './chart-data'

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
  ema: Record<EmaSpan, string>
  bollinger: string
  bollingerMiddle: string
  support: string
  resistance: string
}

const shared = {
  up: '#10b981',
  down: '#ef4444',
  ema: { '10': '#f59e0b', '30': '#3b82f6', '60': '#a855f7', '90': '#ec4899' } as Record<EmaSpan, string>,
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
    bollinger: 'rgba(148,163,184,0.7)',
    bollingerMiddle: 'rgba(148,163,184,0.45)',
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
    bollinger: 'rgba(71,85,105,0.7)',
    bollingerMiddle: 'rgba(71,85,105,0.45)',
  },
}
