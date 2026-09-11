import { http, HttpResponse } from 'msw'
import { cryptoTopFixture, makeIndicators, makePortfolioStats, makeRetirement, makeSentiment, makeSimulation, quoteFixtures, recommendationsFixture, searchFixtures } from './fixtures'
import type { RetirementRequest } from '@/lib/api'

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

  http.get(`${API_URL}/crypto/top`, ({ request }) => {
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 25)
    return HttpResponse.json({ ...cryptoTopFixture, coins: cryptoTopFixture.coins.slice(0, limit) })
  }),

  http.post(`${API_URL}/portfolio/analyse`, async ({ request }) => {
    const body = (await request.json()) as { holdings: Array<{ symbol: string; weight?: number; amount?: number }>; period?: string }
    return portfolioResponse(body) ?? HttpResponse.json(makePortfolioStats(...portfolioInputs(body)))
  }),

  http.post(`${API_URL}/portfolio/simulate`, async ({ request }) => {
    const body = (await request.json()) as {
      holdings: Array<{ symbol: string; weight?: number; amount?: number }>
      period?: string
      horizon_years?: number
      n_sims?: number
      initial_value?: number
      monthly_contribution?: number
    }
    const bad = portfolioResponse(body)
    if (bad) return bad
    const stats = makePortfolioStats(...portfolioInputs(body))
    return HttpResponse.json(
      makeSimulation(stats, {
        horizon_years: body.horizon_years ?? 10,
        n_sims: body.n_sims ?? 2000,
        initial_value: body.initial_value ?? 10_000,
        monthly_contribution: body.monthly_contribution ?? 0,
      }),
    )
  }),

  http.post(`${API_URL}/retirement/project`, async ({ request }) => {
    const body = (await request.json()) as RetirementRequest
    if (!(body.current_age < body.retirement_age && body.retirement_age < body.life_expectancy)) {
      return HttpResponse.json({ detail: 'ages must satisfy current_age < retirement_age < life_expectancy' }, { status: 422 })
    }
    if (body.mode === 'portfolio') {
      const bad = portfolioResponse({ holdings: body.holdings ?? [] })
      if (bad) return bad
      const [symbols] = portfolioInputs({ holdings: body.holdings ?? [] })
      return HttpResponse.json(makeRetirement(body, { mu: 0.07, sigma: 0.18, source: 'portfolio', symbols }))
    }
    return HttpResponse.json(makeRetirement(body))
  }),

  http.get(`${API_URL}/recommendations/:symbol`, ({ params }) => {
    const symbol = String(params.symbol).toUpperCase()
    if (!quoteFixtures[symbol]) return notFound(symbol)
    return HttpResponse.json({ ...recommendationsFixture, symbol })
  }),

  http.get(`${API_URL}/sentiment/status`, () => HttpResponse.json({ enabled: true, model: 'claude-test' })),

  http.get(`${API_URL}/sentiment/:symbol`, ({ params }) => {
    const symbol = String(params.symbol).toUpperCase()
    if (!quoteFixtures[symbol]) return notFound(symbol)
    return HttpResponse.json(makeSentiment(symbol))
  }),
]

type PortfolioBody = { holdings: Array<{ symbol: string; weight?: number; amount?: number }>; period?: string }

/** 422 for an empty/oversized set, 404 for a symbol without a fixture, else null. */
function portfolioResponse(body: PortfolioBody) {
  if (!body.holdings?.length || body.holdings.length > 20) return HttpResponse.json({ detail: 'holdings: 1..20 required' }, { status: 422 })
  const unknown = body.holdings.find((h) => !quoteFixtures[h.symbol.toUpperCase()])
  return unknown ? notFound(unknown.symbol.toUpperCase()) : null
}

function portfolioInputs(body: PortfolioBody): [string[], number[], string] {
  const values = body.holdings.map((h) => h.weight ?? h.amount ?? 0)
  const total = values.reduce((s, v) => s + v, 0) || 1
  return [body.holdings.map((h) => h.symbol.toUpperCase()), values.map((v) => v / total), body.period ?? '2y']
}
