/**
 * Data-viz colours, validated with the dataviz skill's palette checker (adjacent-pair CVD
 * and normal-vision floors, contrast vs surface) on 2026-09-07. Categorical slots are
 * assigned in fixed order and never cycled; the diverging arms are two-step single-hue ramps.
 */
import type { Theme } from '@/components/theme-provider'

export interface VizPalette {
  /** Fixed-order categorical hues for series identity (compare mode caps at 5). */
  categorical: readonly string[]
  /** Diverging scale for the recommendation bar: two blue steps, neutral, two red steps. */
  diverging: { strongBuy: string; buy: string; hold: string; sell: string; strongSell: string }
  /** Muted ink for axes and gridlines. */
  muted: string
  grid: string
  surface: string
}

export const VIZ_PALETTES: Record<Theme, VizPalette> = {
  light: {
    categorical: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
    diverging: { strongBuy: '#2a78d6', buy: '#86b6ef', hold: '#c3c2b7', sell: '#ee9291', strongSell: '#e34948' },
    muted: '#898781',
    grid: '#e1e0d9',
    surface: '#fcfcfb',
  },
  dark: {
    categorical: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
    diverging: { strongBuy: '#3987e5', buy: '#86b6ef', hold: '#55554f', sell: '#f0908f', strongSell: '#e66767' },
    muted: '#898781',
    grid: '#2c2c2a',
    surface: '#1a1a19',
  },
}

export const MAX_COMPARE = 5
