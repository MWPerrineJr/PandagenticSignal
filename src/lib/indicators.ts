/**
 * Indicator selection model shared by the Charts tab, the chart widget and the Crypto tab.
 *
 * A selection is a list of request tokens exactly as the API takes them: `rsi:14`,
 * `macd:12-26-9`, `sr`. The catalog (`GET /indicators/catalog`) is the source of truth for
 * names, parameters and ranges; this module only knows how to read, write and label tokens.
 */
import { z } from 'zod'
import type { IndicatorCatalog, IndicatorSpec } from './api'

export const MAX_INDICATORS = 8
export const DEFAULT_TOKENS: readonly string[] = ['ema:10', 'ema:30', 'ema:60', 'ema:90', 'bb:20-2', 'sr']
export const TOKEN_RE = /^[a-z]+(?::\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)*)?$/

export const tokenListSchema = z.array(z.string().regex(TOKEN_RE)).max(MAX_INDICATORS)

/** Short labels for legends and chips; the catalog has the full names. */
export const SHORT_NAMES: Record<string, string> = {
  sma: 'SMA',
  ema: 'EMA',
  bb: 'BB',
  vwap: 'VWAP',
  psar: 'SAR',
  ichimoku: 'Ichimoku',
  keltner: 'Keltner',
  donchian: 'Donchian',
  sr: 'S/R',
  pivot: 'Pivots',
  rsi: 'RSI',
  macd: 'MACD',
  stoch: 'Stoch',
  adx: 'ADX',
  atr: 'ATR',
  cci: 'CCI',
  obv: 'OBV',
  willr: '%R',
  mfi: 'MFI',
  roc: 'ROC',
}

/** Pre-Phase-12 overlay ids that may still sit in URLs and saved widget configs. */
export const LEGACY_OVERLAYS: Record<string, string> = {
  ema10: 'ema:10',
  ema30: 'ema:30',
  ema60: 'ema:60',
  ema90: 'ema:90',
  bb: 'bb:20-2',
  sr: 'sr',
}

export function tokenId(token: string): string {
  return token.split(':')[0]!.toLowerCase()
}

export function tokenValues(token: string): number[] {
  const raw = token.split(':')[1]
  if (!raw) return []
  return raw.split('-').map(Number)
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value)
}

export function makeToken(id: string, values: number[]): string {
  return values.length ? `${id}:${values.map(fmt).join('-')}` : id
}

export function specOf(token: string, catalog: IndicatorCatalog | undefined): IndicatorSpec | undefined {
  return catalog?.indicators.find((s) => s.id === tokenId(token))
}

/**
 * Fill in defaults and validate against the catalog so `rsi` and `rsi:14` compare equal.
 * Returns null for an unknown indicator or an out-of-range parameter.
 */
export function canonicalToken(token: string, catalog: IndicatorCatalog): string | null {
  const spec = specOf(token, catalog)
  if (!spec) return null
  const given = tokenValues(token)
  if (given.length > spec.params.length) return null
  const values: number[] = []
  for (const [i, p] of spec.params.entries()) {
    const v = given[i]
    if (v === undefined) {
      values.push(p.default)
      continue
    }
    if (!Number.isFinite(v) || v < p.min || v > p.max || (p.integer && !Number.isInteger(v))) return null
    values.push(v)
  }
  return makeToken(spec.id, values)
}

/** Canonical, de-duplicated, capped; unknown tokens are dropped. */
export function normaliseTokens(tokens: readonly string[], catalog: IndicatorCatalog): string[] {
  const out: string[] = []
  for (const t of tokens) {
    const c = canonicalToken(t, catalog)
    if (c && !out.includes(c)) out.push(c)
  }
  return out.slice(0, MAX_INDICATORS)
}

/** Parse a persisted or shared list; anything unreadable falls back to the defaults. */
export function parseTokens(raw: unknown): string[] {
  const parsed = tokenListSchema.safeParse(raw)
  if (!parsed.success) return [...DEFAULT_TOKENS]
  const out = parsed.data.filter((t, i, arr) => arr.indexOf(t) === i)
  return out
}

/** `ema10,bb,sr` (old `ov=` links / widget configs) → tokens. Unknown ids are dropped. */
export function fromLegacy(ids: readonly string[]): string[] {
  const out: string[] = []
  for (const id of ids) {
    const token = LEGACY_OVERLAYS[id]
    if (token && !out.includes(token)) out.push(token)
  }
  return out
}

/** "RSI 14", "MACD 12/26/9", "BB 20/2", "S/R". */
export function tokenLabel(token: string): string {
  const id = tokenId(token)
  const name = SHORT_NAMES[id] ?? id.toUpperCase()
  const values = tokenValues(token)
  return values.length ? `${name} ${values.map(fmt).join('/')}` : name
}

/** Overlay ids, for callers that have not loaded the catalog yet (mirrors the API registry). */
const OVERLAY_IDS: ReadonlySet<string> = new Set(['sma', 'ema', 'bb', 'vwap', 'psar', 'ichimoku', 'keltner', 'donchian', 'sr', 'pivot'])

export function isOverlayToken(token: string, catalog: IndicatorCatalog | undefined): boolean {
  const spec = specOf(token, catalog)
  return spec ? spec.kind === 'overlay' : OVERLAY_IDS.has(tokenId(token))
}

export function tokensEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i])
}

export const CATALOG_GROUPS = [
  { kind: 'overlay', label: 'Overlays (on the price chart)' },
  { kind: 'pane', label: 'Oscillators (own pane)' },
] as const
