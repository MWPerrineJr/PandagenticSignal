import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { cryptoTopFixture, makeIndicators, quoteFixtures } from '@/test/fixtures'
import { ApiError, api, cryptoTopSchema, indicatorsSchema, isCryptoQuote, quoteSchema, recommendationsSchema } from './api'

describe('api client', () => {
  it('parses a quote', async () => {
    const quote = await api.quote('aapl')
    expect(quote.symbol).toBe('AAPL')
    expect(quote.price).toBe(200)
  })

  it('parses optional nulls', async () => {
    const quote = await api.quote('MSFT')
    expect(quote.day_high).toBeNull()
  })

  it('throws ApiError with the server detail on 404', async () => {
    await expect(api.quote('NOPE')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Unknown ticker: NOPE',
      isNotFound: true,
    })
  })

  it('falls back to status text when the error body is not JSON', async () => {
    server.use(http.get(`${API_URL}/quote/:symbol`, () => new HttpResponse('boom', { status: 502, statusText: 'Bad Gateway' })))
    await expect(api.quote('AAPL')).rejects.toBeInstanceOf(ApiError)
    await expect(api.quote('AAPL')).rejects.toThrow('Bad Gateway')
  })

  it('rejects a payload that drifts from the schema', async () => {
    server.use(http.get(`${API_URL}/quote/:symbol`, () => HttpResponse.json({ symbol: 'AAPL', price: 'n/a' })))
    await expect(api.quote('AAPL')).rejects.toThrow()
  })

  it('sends query params for search, history and quotes', async () => {
    const seen: string[] = []
    server.use(
      http.get(`${API_URL}/search`, ({ request }) => {
        seen.push(new URL(request.url).search)
        return HttpResponse.json([])
      }),
      http.get(`${API_URL}/history/:symbol`, ({ request }) => {
        seen.push(new URL(request.url).search)
        return HttpResponse.json({ symbol: 'AAPL', period: '6mo', interval: '1h', candles: [] })
      }),
      http.get(`${API_URL}/quotes`, ({ request }) => {
        seen.push(new URL(request.url).search)
        return HttpResponse.json({ quotes: [], missing: [] })
      }),
    )
    await api.search('apple', 5)
    await api.history('aapl', '6mo', '1h')
    await api.quotes(['aapl', 'msft'])
    expect(seen).toEqual(['?q=apple&limit=5', '?period=6mo&interval=1h', '?tickers=AAPL%2CMSFT'])
  })

  it('parses indicators and recommendations', async () => {
    const ind = await api.indicators('AAPL')
    expect(ind.candles).toHaveLength(30)
    expect(Object.keys(ind.series)).toEqual(['ema:10', 'ema:30', 'ema:60', 'ema:90', 'bb:20-2', 'sr'])
    expect(ind.series['ema:10']!.outputs.ema).toHaveLength(30)
    expect(ind.series['bb:20-2']!.outputs.middle![0]).toBeNull()
    expect(ind.levels[0]?.kind).toBe('resistance')

    const rec = await api.recommendations('AAPL')
    expect(rec.summary[0]?.strong_buy).toBe(6)
    expect(rec.upgrades_downgrades[0]?.firm).toBe('Morgan Stanley')
  })

  it('fetches the top coins with a limit', async () => {
    const top = await api.cryptoTop(2)
    expect(top.coins.map((c) => c.symbol)).toEqual(['BTC-USD', 'ETH-USD'])
    expect(top.coins[0]?.change_pct).toBe(1.5)
    expect(typeof top.as_of).toBe('number')
  })

  it('posts portfolio requests as JSON and parses the analytics', async () => {
    const stats = await api.portfolioAnalyse({ holdings: [{ symbol: 'aapl', weight: 3 }, { symbol: 'BTC-USD', weight: 1 }], period: '1y' })
    expect(stats.symbols).toEqual(['AAPL', 'BTC-USD'])
    expect(stats.weights).toEqual([0.75, 0.25])
    expect(stats.correlation).toHaveLength(2)
    const sim = await api.portfolioSimulate({
      holdings: [{ symbol: 'AAPL', amount: 100 }],
      period: '2y',
      horizon_years: 5,
      n_sims: 500,
      initial_value: 1000,
      monthly_contribution: 50,
    })
    expect(sim.times[0]).toBe(0)
    expect(sim.times.at(-1)).toBe(5)
    expect(sim.bands.p50?.[0]).toBe(1000)
    expect(sim.stats.symbols).toEqual(['AAPL'])
    await expect(api.portfolioAnalyse({ holdings: [], period: '2y' })).rejects.toMatchObject({ status: 422 })
    await expect(api.portfolioAnalyse({ holdings: [{ symbol: 'NOPE', weight: 1 }], period: '2y' })).rejects.toMatchObject({ status: 404 })
  })

  it('flags crypto quotes by quote_type', async () => {
    expect(isCryptoQuote(await api.quote('BTC-USD'))).toBe(true)
    expect(isCryptoQuote(await api.quote('AAPL'))).toBe(false)
    expect(isCryptoQuote(await api.quote('MSFT'))).toBe(false) // field absent
    expect(isCryptoQuote(null)).toBe(false)
  })
})

describe('schemas', () => {
  it('accept the fixtures used by MSW', () => {
    expect(quoteSchema.safeParse(quoteFixtures.AAPL).success).toBe(true)
    expect(indicatorsSchema.safeParse(makeIndicators()).success).toBe(true)
    expect(cryptoTopSchema.safeParse(cryptoTopFixture).success).toBe(true)
    expect(recommendationsSchema.safeParse({ symbol: 'X', summary: [], price_targets: {}, upgrades_downgrades: [] }).success).toBe(true)
  })

  it('reject an unknown level kind', () => {
    const bad = makeIndicators()
    // @ts-expect-error intentionally invalid
    bad.levels[0].kind = 'pivot'
    expect(indicatorsSchema.safeParse(bad).success).toBe(false)
  })
})
