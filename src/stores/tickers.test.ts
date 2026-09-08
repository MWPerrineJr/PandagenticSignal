import { MAX_TRACKED, useTickerStore } from './tickers'

beforeEach(() => {
  useTickerStore.getState().clear()
  localStorage.clear()
})

describe('ticker store', () => {
  it('adds, normalises and dedupes symbols', () => {
    const { add } = useTickerStore.getState()
    add(' aapl ')
    add('AAPL')
    add('msft')
    expect(useTickerStore.getState().tickers).toEqual(['AAPL', 'MSFT'])
    expect(useTickerStore.getState().has('aapl')).toBe(true)
  })

  it('removes and toggles', () => {
    const s = useTickerStore.getState()
    s.toggle('AAPL')
    s.toggle('MSFT')
    s.toggle('AAPL')
    expect(useTickerStore.getState().tickers).toEqual(['MSFT'])
    s.remove('msft')
    expect(useTickerStore.getState().tickers).toEqual([])
  })

  it('caps the list and ignores blanks', () => {
    const { add } = useTickerStore.getState()
    add('')
    for (let i = 0; i < MAX_TRACKED + 5; i++) add(`T${i}`)
    expect(useTickerStore.getState().tickers).toHaveLength(MAX_TRACKED)
  })

  it('persists to localStorage', () => {
    useTickerStore.getState().add('NVDA')
    expect(localStorage.getItem('stock-tool.tickers')).toContain('NVDA')
  })
})

describe('reorder', () => {
  it('moves up and down and clamps at the ends', () => {
    const s = useTickerStore.getState()
    s.add('A')
    s.add('B')
    s.add('C')
    s.move('C', -1)
    expect(useTickerStore.getState().tickers).toEqual(['A', 'C', 'B'])
    s.move('A', 1)
    expect(useTickerStore.getState().tickers).toEqual(['C', 'A', 'B'])
    s.move('C', -5)
    expect(useTickerStore.getState().tickers).toEqual(['C', 'A', 'B'])
    s.move('B', 9)
    expect(useTickerStore.getState().tickers).toEqual(['C', 'A', 'B'])
    s.move('ZZZ', 1)
    s.move('A', 0)
    expect(useTickerStore.getState().tickers).toEqual(['C', 'A', 'B'])
  })
})
