import { indicatorCatalogFixture as catalog } from '@/test/fixtures'
import {
  DEFAULT_TOKENS,
  MAX_INDICATORS,
  canonicalToken,
  fromLegacy,
  isOverlayToken,
  makeToken,
  normaliseTokens,
  parseTokens,
  tokenLabel,
  tokenValues,
  tokensEqual,
} from './indicators'

describe('indicator tokens', () => {
  it('the catalog fixture carries the twenty and the API defaults', () => {
    expect(catalog.indicators).toHaveLength(20)
    expect(catalog.defaults).toEqual([...DEFAULT_TOKENS])
    expect(catalog.max_per_request).toBe(MAX_INDICATORS)
  })

  it('canonicalises against the catalog and rejects bad parameters', () => {
    expect(canonicalToken('rsi', catalog)).toBe('rsi:14')
    expect(canonicalToken('macd:5-20', catalog)).toBe('macd:5-20-9')
    expect(canonicalToken('bb:20-2.5', catalog)).toBe('bb:20-2.5')
    expect(canonicalToken('sr', catalog)).toBe('sr')
    expect(canonicalToken('nope', catalog)).toBeNull()
    expect(canonicalToken('rsi:1', catalog)).toBeNull()
    expect(canonicalToken('rsi:14.5', catalog)).toBeNull() // integer param
    expect(canonicalToken('rsi:14-3', catalog)).toBeNull()
  })

  it('normalises, dedupes and caps a list', () => {
    expect(normaliseTokens(['rsi', 'RSI:14', 'nope', 'sma:50'], catalog)).toEqual(['rsi:14', 'sma:50'])
    const many = Array.from({ length: 12 }, (_, i) => `sma:${i + 2}`)
    expect(normaliseTokens(many, catalog)).toHaveLength(MAX_INDICATORS)
  })

  it('parses persisted lists, falling back to the defaults', () => {
    expect(parseTokens(['rsi:14', 'rsi:14', 'sr'])).toEqual(['rsi:14', 'sr'])
    expect(parseTokens('garbage')).toEqual([...DEFAULT_TOKENS])
    expect(parseTokens(['drop;table'])).toEqual([...DEFAULT_TOKENS])
    expect(parseTokens(Array.from({ length: 9 }, () => 'sr'))).toEqual([...DEFAULT_TOKENS])
  })

  it('maps legacy overlay ids and labels tokens', () => {
    expect(fromLegacy(['ema10', 'bb', 'bogus', 'sr', 'bb'])).toEqual(['ema:10', 'bb:20-2', 'sr'])
    expect(tokenLabel('rsi:14')).toBe('RSI 14')
    expect(tokenLabel('macd:12-26-9')).toBe('MACD 12/26/9')
    expect(tokenLabel('bb:20-2.5')).toBe('BB 20/2.5')
    expect(tokenLabel('sr')).toBe('S/R')
    expect(tokenLabel('mystery:3')).toBe('MYSTERY 3')
    expect(makeToken('macd', [12, 26, 9])).toBe('macd:12-26-9')
    expect(tokenValues('obv')).toEqual([])
  })

  it('knows overlays from panes, with and without the catalog', () => {
    expect(isOverlayToken('bb:20-2', catalog)).toBe(true)
    expect(isOverlayToken('rsi:14', catalog)).toBe(false)
    expect(isOverlayToken('ema:10', undefined)).toBe(true)
    expect(isOverlayToken('rsi:14', undefined)).toBe(false)
    expect(tokensEqual(['a'], ['a'])).toBe(true)
    expect(tokensEqual(['a'], ['a', 'b'])).toBe(false)
  })
})
