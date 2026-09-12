/**
 * FAQ content as data, so tests can assert every section renders and the endpoint table
 * comes from `endpoints.json` (generated from the API by `api/scripts/export_endpoints.py`).
 * Numbers that come from API settings are read from that file, not typed here.
 */
import endpoints from './endpoints.json'

export interface FaqEntry {
  q: string
  /** Paragraphs. Inline `code` is written with backticks and rendered as <code>. */
  a: string[]
}

export interface FaqSection {
  id: string
  title: string
  intro?: string
  entries: FaqEntry[]
}

export interface EndpointRow {
  method: string
  path: string
  tag: string
  purpose: string
  cache: Array<{ what: string; seconds: number }>
  rate_limit: string | null
}

export const ENDPOINTS: EndpointRow[] = endpoints.endpoints
export const API_VERSION: string = endpoints.api_version
export const RATE_LIMIT_DEFAULT: string = endpoints.rate_limit_default

const ttl = (what: string): number => {
  for (const e of ENDPOINTS) for (const c of e.cache) if (c.what === what) return c.seconds
  return 0
}
export function seconds(s: number): string {
  if (s >= 3600) {
    const h = s / 3600
    return `${h} hour${h === 1 ? '' : 's'}`
  }
  if (s >= 60) {
    const m = s / 60
    return `${m} minute${m === 1 ? '' : 's'}`
  }
  return `${s} second${s === 1 ? '' : 's'}`
}

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'what',
    title: 'What this tool is',
    entries: [
      {
        q: 'What does Pandagentic Signal do?',
        a: [
          'It is a personal research dashboard: quotes, charts with technical indicators, a watchlist, analyst ratings, a crypto market table, a portfolio builder with Monte Carlo projections, a retirement planner, and an AI summary of recent news tone.',
          'It shows you data and models so you can form your own view. It does not tell you what to buy or sell and it does not know your situation. See the disclaimer.',
        ],
      },
      {
        q: 'Do I need an account?',
        a: [
          'No. Everything works signed out; your watchlist, dashboard layout, portfolios and indicator selection are kept in this browser. Signing in moves them to your account so they follow you across devices, and imports what was in the browser the first time.',
        ],
      },
    ],
  },
  {
    id: 'delays',
    title: 'Data sources and delays',
    intro: 'Nothing here is a live trading feed. Every number is fetched from a public source, cached on our server for a while, and can be stale.',
    entries: [
      {
        q: 'Where do stock and ETF prices come from, and how delayed are they?',
        a: [
          `Yahoo Finance, via the yfinance library. Yahoo's quotes can lag the exchange by up to 15–20 minutes depending on the market, and our server caches each quote for ${seconds(ttl('quotes'))} on top of that. Treat prices as indicative, not executable.`,
          `Daily and weekly candles are cached for ${seconds(ttl('candles'))}; the last bar of the day is the session so far, not a closed bar. Intraday candles (1m–1h) carry Yahoo's delay too.`,
          'Closes are adjusted for splits and dividends (Yahoo\'s adjusted close), so historical returns include distributions.',
        ],
      },
      {
        q: 'Where do crypto prices come from?',
        a: [
          `Prices, 24-hour ranges and candles come from Coinbase's public market data for USD pairs; they reflect Coinbase's order book, which can differ from other exchanges. Our cache holds them for ${seconds(ttl('coin prices'))}.`,
          `The market-cap ranking, circulating supply and icons come from CoinGecko, refreshed every ${seconds(ttl('market-cap ranking'))}; if CoinGecko is unreachable we keep serving the last good ranking for up to a day and mark nothing, so ranks can be slightly behind. Coins Coinbase does not trade fall back to Yahoo's quote.`,
          'Coins trade around the clock, so "24h" replaces the daily session in the crypto tables.',
        ],
      },
      {
        q: 'How fresh are analyst ratings and news?',
        a: [
          `Analyst summaries, price targets and rating changes are Yahoo's aggregation of published research; Yahoo refreshes them roughly daily and we cache them for ${seconds(ttl('analyst data'))}.`,
          `Headlines come from Yahoo's news feed for the symbol and are cached for ${seconds(ttl('headlines'))}. The AI sentiment report built from them is cached for ${seconds(ttl('sentiment report'))} per symbol, so it will not reflect a story that broke ten minutes ago.`,
        ],
      },
      {
        q: 'Why did a page say "rate limit reached"?',
        a: [
          'The upstream sources throttle free access. When Yahoo or CoinGecko refuse a request the API answers 503 and the page retries a couple of times; it usually clears in seconds. Our own per-visitor limits are listed in the endpoint table below.',
        ],
      },
    ],
  },
  {
    id: 'assumptions',
    title: 'Assumptions in the models',
    intro: 'Every projection here is a simplified model of the world. These are the choices baked in.',
    entries: [
      {
        q: 'Technical indicators',
        a: [
          'All twenty-one indicators are computed on our server from the same candles, using the textbook definitions listed in the catalog below (Wilder smoothing for RSI, ATR and ADX; population standard deviation for Bollinger Bands; slow stochastic; classic floor-trader pivots from the previous bar). Values are blank until the indicator has enough history to warm up.',
          'VWAP resets each session on intraday bars and accumulates from the first bar shown on daily and weekly charts. The Ichimoku cloud is shifted forward within the visible range, so the last 26 bars show no cloud. Support and resistance levels are clusters of local highs and lows within 2% of each other, ranked by how often price touched them. The Fibonacci retracement draws the standard ratios (23.6/38.2/50/61.8/78.6%) between the period\'s swing high and low, auto-anchored to whichever extreme came first — no trendline to draw by hand.',
        ],
      },
      {
        q: 'Portfolio statistics and Monte Carlo',
        a: [
          'Returns are daily log returns of adjusted closes over the period you choose (one, two or five years), aligned on calendar dates shared by every holding. Annualised return and volatility scale those by 252 trading days; the Sharpe ratio assumes a 0% risk-free rate; max drawdown is from daily closes.',
          'The simulation draws correlated lognormal returns from the historical mean and covariance (shrunk toward the diagonal when there are more than five assets, which steadies the estimate), rebalances to your target weights every step, adds any monthly contribution, and never lets a balance go below zero. It steps daily up to two years, weekly up to ten, monthly beyond. 2,000 paths by default; the fan shows the 5th, 25th, 50th, 75th and 95th percentiles.',
          'It ignores taxes, fees, slippage and inflation, assumes the future looks statistically like the chosen history, and cannot know about events that history does not contain. Value at risk and expected shortfall are measured against the money you put in.',
        ],
      },
      {
        q: 'Retirement projection',
        a: [
          'One step per year. You contribute 12 × the monthly amount each year until retirement age, then withdraw the annual spending, which grows with inflation every year. Balances are floored at zero.',
          'The deterministic line compounds at exactly the expected return. The Monte Carlo run uses lognormal yearly returns with the volatility you set (or the volatility measured from a saved portfolio), 2,000 paths, and reports the share of paths with money left at your life expectancy. Bands are shown in today\'s dollars.',
          'It ignores taxes, Social Security or pensions, healthcare shocks, sequence-of-returns beyond what randomness produces, and any change in spending. The default plan is deliberately tight so the tool shows what "runs out" looks like.',
        ],
      },
      {
        q: 'AI news sentiment',
        a: [
          'A Claude model reads up to twelve recent headlines and summaries for the symbol and classifies each as bullish, neutral or bearish for that ticker, with a short reason, an overall score from −1 to +1 and a confidence. The prompt forbids advice, price targets and predictions, and asks for neutral, low-confidence answers when coverage is thin or off-topic.',
          'It is an automated summary of the tone of coverage, not a view on the company. Models make mistakes, headlines can be wrong, and the report is cached for an hour.',
        ],
      },
    ],
  },
  {
    id: 'endpoints',
    title: 'API endpoints',
    intro: `The site talks to our FastAPI service (version ${API_VERSION}). The table is generated from the running API, so it cannot drift. Rate limits are per visitor IP per minute; cache times are how long our server keeps a response before asking the source again.`,
    entries: [],
  },
  {
    id: 'privacy',
    title: 'Accounts and privacy',
    entries: [
      {
        q: 'What is stored when I sign in?',
        a: [
          'Your email, watchlist symbols, dashboard layouts, saved portfolios and chart indicator selection, in a Supabase Postgres database with row-level security so only your account can read or change your rows. Nothing is sold or shared. Signed out, the same data lives in this browser\'s local storage only.',
          'The API itself stores nothing about you: it caches market data in memory and logs request paths and response times without identifying information.',
        ],
      },
      {
        q: 'Do you send my portfolio to the AI model?',
        a: [
          'No. Only the ticker symbol and Yahoo\'s public headlines for it are sent to Anthropic when you press "Analyse news sentiment". Portfolios, watchlists and account details never leave our systems.',
        ],
      },
    ],
  },
  {
    id: 'limits',
    title: 'Limits',
    entries: [
      {
        q: 'What are the caps?',
        a: [
          `Twenty symbols per watchlist, twenty holdings per portfolio, five symbols in compare mode, eight indicators per chart, ten thousand Monte Carlo paths per run, and ${RATE_LIMIT_DEFAULT} requests per visitor for most endpoints (tighter for simulations and sentiment, see the table).`,
        ],
      },
    ],
  },
]
