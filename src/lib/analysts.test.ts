import { recommendationsFixture } from '@/test/fixtures'
import { consensus, gradeDirection, hasCoverage, periodLabel, totalAnalysts, trackPosition, upside } from './analysts'

const period = (over: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...over })
const base = () => ({ period: '0m', strong_buy: 0, buy: 0, hold: 0, sell: 0, strong_sell: 0 })

describe('consensus', () => {
  it('weights ratings 5→1 and buckets the label', () => {
    expect(consensus(period({ strong_buy: 10 }))).toMatchObject({ label: 'Strong buy', score: 5, analysts: 10 })
    expect(consensus(period({ buy: 3, hold: 1 }))!.label).toBe('Buy') // 3.75
    expect(consensus(period({ hold: 5 }))!.label).toBe('Hold')
    expect(consensus(period({ sell: 4, hold: 1 }))!.label).toBe('Sell') // 2.2
    expect(consensus(period({ strong_sell: 2 }))!.label).toBe('Strong sell')
  })

  it('is null without analysts', () => {
    expect(consensus(undefined)).toBeNull()
    expect(consensus(period())).toBeNull()
  })

  it('matches the fixture', () => {
    const c = consensus(recommendationsFixture.summary[0])!
    expect(c.analysts).toBe(43)
    expect(c.score).toBeCloseTo((30 + 72 + 39 + 6 + 3) / 43)
  })
})

describe('helpers', () => {
  it('periodLabel', () => {
    expect(periodLabel('0m')).toBe('This month')
    expect(periodLabel('-1m')).toBe('1 month ago')
    expect(periodLabel('-3m')).toBe('3 months ago')
    expect(periodLabel('weird')).toBe('weird')
  })

  it('totalAnalysts', () => {
    expect(totalAnalysts(period({ buy: 2, sell: 3 }))).toBe(5)
  })

  it('hasCoverage', () => {
    expect(hasCoverage(recommendationsFixture)).toBe(true)
    expect(hasCoverage({ symbol: 'QQQ', summary: [], price_targets: {}, upgrades_downgrades: [] })).toBe(false)
    expect(hasCoverage({ symbol: 'X', summary: [period()], price_targets: { mean: 10 }, upgrades_downgrades: [] })).toBe(true)
  })

  it('upside and trackPosition', () => {
    expect(upside(100, 125)).toBeCloseTo(25)
    expect(upside(100, 80)).toBeCloseTo(-20)
    expect(upside(null, 10)).toBeNull()
    expect(upside(0, 10)).toBeNull()
    expect(trackPosition(150, 100, 200)).toBe(0.5)
    expect(trackPosition(500, 100, 200)).toBe(1)
    expect(trackPosition(0, 100, 200)).toBe(0)
    expect(trackPosition(150, 200, 100)).toBeNull()
    expect(trackPosition(null, 0, 1)).toBeNull()
  })

  it('gradeDirection', () => {
    expect(gradeDirection('up')).toBe('up')
    expect(gradeDirection('Down')).toBe('down')
    expect(gradeDirection('init')).toBe('new')
    expect(gradeDirection('main')).toBe('same')
    expect(gradeDirection(null)).toBe('same')
  })
})
