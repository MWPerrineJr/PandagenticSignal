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
