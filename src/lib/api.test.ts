import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { makeIndicators, quoteFixtures } from '@/test/fixtures'
import { ApiError, api, indicatorsSchema, quoteSchema, recommendationsSchema } from './api'

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
    expect(ind.ema['10']).toHaveLength(30)
    expect(ind.bollinger.middle[0]).toBeNull()
    expect(ind.levels[0]?.kind).toBe('resistance')

    const rec = await api.recommendations('AAPL')
    expect(rec.summary[0]?.strong_buy).toBe(6)
    expect(rec.upgrades_downgrades[0]?.firm).toBe('Morgan Stanley')
  })
})

describe('schemas', () => {
  it('accept the fixtures used by MSW', () => {
    expect(quoteSchema.safeParse(quoteFixtures.AAPL).success).toBe(true)
    expect(indicatorsSchema.safeParse(makeIndicators()).success).toBe(true)
    expect(recommendationsSchema.safeParse({ symbol: 'X', summary: [], price_targets: {}, upgrades_downgrades: [] }).success).toBe(true)
  })

  it('reject an unknown level kind', () => {
    const bad = makeIndicators()
    // @ts-expect-error intentionally invalid
    bad.levels[0].kind = 'pivot'
    expect(indicatorsSchema.safeParse(bad).success).toBe(false)
  })
})
