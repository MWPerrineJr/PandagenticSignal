import {
  MAX_HOLDINGS,
  holdingsEqual,
  holdingsKey,
  makePortfolio,
  normaliseHoldings,
  parsePortfolio,
  parseStoredHoldings,
  serialiseHoldings,
  starterPortfolio,
  toRequestHoldings,
  weightsFromHoldings,
} from './portfolio'

describe('portfolio model', () => {
  it('normalises holdings: upper-case, dedupe, drop bad values, cap the count', () => {
    const out = normaliseHoldings([
      { symbol: ' aapl ', value: 40 },
      { symbol: 'AAPL', value: 10 },
      { symbol: 'msft', value: 0 },
      { symbol: '', value: 5 },
      { symbol: 'btc-usd', value: Number.NaN },
      { symbol: 'eth-usd', value: 60 },
    ])
    expect(out).toEqual([
      { symbol: 'AAPL', value: 40 },
      { symbol: 'ETH-USD', value: 60 },
    ])
    const many = Array.from({ length: 25 }, (_, i) => ({ symbol: `S${i}`, value: 1 }))
    expect(normaliseHoldings(many)).toHaveLength(MAX_HOLDINGS)
  })

  it('derives weights and a stable, order-insensitive key', () => {
    const h = [
      { symbol: 'AAPL', value: 3 },
      { symbol: 'MSFT', value: 1 },
    ]
    expect(weightsFromHoldings(h)).toEqual([0.75, 0.25])
    expect(weightsFromHoldings([])).toEqual([])
    expect(holdingsKey(h, 'weight')).toBe('weight:AAPL=3,MSFT=1')
    expect(holdingsKey([...h].reverse(), 'weight')).toBe(holdingsKey(h, 'weight'))
    expect(holdingsKey(h, 'amount')).not.toBe(holdingsKey(h, 'weight'))
    expect(holdingsEqual({ holdings: h, mode: 'weight' }, { holdings: [...h].reverse(), mode: 'weight' })).toBe(true)
    expect(holdingsEqual({ holdings: h, mode: 'weight' }, { holdings: h, mode: 'amount' })).toBe(false)
  })

  it('serialises to API rows and parses them back, deriving the mode', () => {
    const p = makePortfolio('Mine', [{ symbol: 'AAPL', value: 500 }, { symbol: 'BTC-USD', value: 250 }], 'amount')
    const rows = serialiseHoldings(p)
    expect(rows).toEqual([
      { symbol: 'AAPL', amount: 500 },
      { symbol: 'BTC-USD', amount: 250 },
    ])
    expect(parseStoredHoldings(rows)).toEqual({ mode: 'amount', holdings: p.holdings })
    expect(toRequestHoldings(p.holdings, 'weight')).toEqual([
      { symbol: 'AAPL', weight: 500 },
      { symbol: 'BTC-USD', weight: 250 },
    ])
    expect(parseStoredHoldings([{ symbol: 'aapl', weight: 1 }, { symbol: 'X', amount: 2 }])).toEqual({
      mode: 'weight',
      holdings: [{ symbol: 'AAPL', value: 1 }],
    })
    expect(parseStoredHoldings(null)).toEqual({ mode: 'weight', holdings: [] })
    expect(() => parseStoredHoldings([{ symbol: 'A', weight: -1 }])).toThrow()
    expect(() => parseStoredHoldings(Array.from({ length: 21 }, () => ({ symbol: 'A', weight: 1 })))).toThrow()
  })

  it('parses and validates a stored portfolio', () => {
    const p = parsePortfolio({ id: 'p1', name: 'X', holdings: [{ symbol: 'aapl', value: 2 }], updatedAt: '2026-01-01' })
    expect(p).toEqual({ id: 'p1', name: 'X', mode: 'weight', holdings: [{ symbol: 'AAPL', value: 2 }], updatedAt: '2026-01-01' })
    expect(() => parsePortfolio({ id: '', name: 'X', holdings: [], updatedAt: '' })).toThrow()
    expect(() => parsePortfolio({ id: 'p', name: 'X', holdings: [{ symbol: 'A', value: -1 }], updatedAt: '' })).toThrow()
    const s = starterPortfolio()
    expect(s.holdings).toEqual([])
    expect(s.name).toBe('My portfolio')
    expect(s.id).not.toBe(starterPortfolio().id)
  })
})
