import { formatChange, formatCompact, formatPct, formatPrice } from './format'

describe('format', () => {
  it('formats prices with two decimals and sub-dollar prices with more', () => {
    expect(formatPrice(65000)).toBe('$65,000.00')
    expect(formatPrice(0.1234)).toBe('$0.1234')
    expect(formatPrice(0.000123456)).toBe('$0.000123')
    expect(formatPrice(0)).toBe('$0.00')
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice(Number.NaN)).toBe('—')
    expect(formatPrice(12.5, 'EUR')).toBe('€12.50')
  })

  it('formats signed percentages and changes', () => {
    expect(formatPct(1.5)).toBe('+1.50%')
    expect(formatPct(-0.75)).toBe('-0.75%')
    expect(formatPct(0)).toBe('0.00%')
    expect(formatPct(null)).toBe('—')
    expect(formatChange(10, 5.263)).toBe('+10.00 (+5.26%)')
    expect(formatChange(null, 1)).toBe('—')
  })

  it('formats compact magnitudes', () => {
    expect(formatCompact(1.3e12)).toBe('1.3T')
    expect(formatCompact(31e9)).toBe('31B')
    expect(formatCompact(undefined)).toBe('—')
  })
})
