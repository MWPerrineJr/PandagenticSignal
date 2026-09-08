import { http, HttpResponse } from 'msw'
import { makeIndicators, quoteFixtures, recommendationsFixture, searchFixtures } from './fixtures'

import { API_URL } from '@/lib/api'

export { API_URL }

const notFound = (symbol: string) => HttpResponse.json({ detail: `Unknown ticker: ${symbol}` }, { status: 404 })

/** Default MSW handlers shared by all tests. Override per test with server.use(...). */
export const handlers = [
  http.get(`${API_URL}/health`, () => HttpResponse.json({ status: 'ok' })),

  http.get(`${API_URL}/search`, ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase()
    const hit = Object.entries(searchFixtures).find(([key]) => key.startsWith(q) || q.startsWith(key))
    return HttpResponse.json(hit ? hit[1] : [])
  }),

  http.get(`${API_URL}/quote/:symbol`, ({ params }) => {
    const symbol = String(params.symbol).toUpperCase()
    const quote = quoteFixtures[symbol]
    return quote ? HttpResponse.json(quote) : notFound(symbol)
  }),

  http.get(`${API_URL}/quotes`, ({ request }) => {
    const tickers = (new URL(request.url).searchParams.get('tickers') ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
    const quotes = tickers.flatMap((t) => (quoteFixtures[t] ? [quoteFixtures[t]] : []))
    const missing = tickers.filter((t) => !quoteFixtures[t])
    return HttpResponse.json({ quotes, missing })
  }),

  http.get(`${API_URL}/history/:symbol`, ({ params, request }) => {
    const symbol = String(params.symbol).toUpperCase()
    if (!quoteFixtures[symbol]) return notFound(symbol)
    const url = new URL(request.url)
    const { candles } = makeIndicators(symbol)
    return HttpResponse.json({
      symbol,
      period: url.searchParams.get('period') ?? '1y',
      interval: url.searchParams.get('interval') ?? '1d',
      candles,
    })
  }),

  http.get(`${API_URL}/indicators/:symbol`, ({ params, request }) => {
    const symbol = String(params.symbol).toUpperCase()
    if (!quoteFixtures[symbol]) return notFound(symbol)
    const url = new URL(request.url)
    return HttpResponse.json({
      ...makeIndicators(symbol),
      period: url.searchParams.get('period') ?? '1y',
      interval: url.searchParams.get('interval') ?? '1d',
    })
  }),

  http.get(`${API_URL}/recommendations/:symbol`, ({ params }) => {
    const symbol = String(params.symbol).toUpperCase()
    if (!quoteFixtures[symbol]) return notFound(symbol)
    return HttpResponse.json({ ...recommendationsFixture, symbol })
  }),
]
