# Stock Analysis Tool

A trader-facing stock analysis web app: ticker/company search, candlestick charts with
technical indicators (EMA 10/30/60/90, Bollinger Bands, support/resistance), compare mode,
a watchlist with live quotes, analyst ratings and price targets, and a customizable
dashboard with drag-and-drop widgets. Accounts sync the watchlist and dashboards across
devices. Market data comes from [yfinance](https://github.com/ranaroussi/yfinance).

## Architecture

```
Browser ──► React app (repo root: Vite + TS + Tailwind + shadcn/ui)   ← Lovable imports this
                │
                ├──► FastAPI + yfinance service (api/)                ← Docker on Render/Railway
                │      /search /quote /quotes /history /indicators /recommendations
                │      /crypto/top  POST /portfolio/analyse  POST /portfolio/simulate
                │      POST /retirement/project  /sentiment/{ticker} (Claude, optional key)
                │      in-process cache, per-IP rate limit, JSON logs
                │
                └──► Supabase (auth, watchlists, dashboards, portfolios) ← supabase/migrations, RLS
```

The frontend lives at the repository root because Lovable's GitHub import expects a Vite
project there. The Python API cannot run inside Lovable, so it is deployed separately and the
browser calls it directly (CORS-restricted to the app's origins). Signed-out users get the
full app with the watchlist and dashboard kept in the browser; signing in moves both to
Supabase and imports the local data once.

## Local development

Prerequisites: Node 24, [uv](https://docs.astral.sh/uv/), optionally the Supabase CLI
(`brew install supabase/tap/supabase`) and Docker for image builds.

```bash
# Frontend  (http://localhost:5173)
echo 'VITE_API_URL=http://localhost:8000' > .env.local   # override the hosted API in .env
npm install
npm run dev

# API  (http://localhost:8000, interactive docs at /docs)
cd api
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload
```

## Testing

| Command | What it runs |
|---|---|
| `npm test` | vitest unit/component tests; MSW mocks the API, an in-memory fake replaces Supabase |
| `npm run test:coverage` | same, with coverage |
| `npm run typecheck` / `npm run lint` / `npm run build` | TypeScript, oxlint, production build |
| `npm run e2e` | Playwright smoke test against the local dev servers and live Yahoo data (starts both servers if needed) |
| `cd api && uv run pytest` | Python unit tests, no network, coverage gate 80% |
| `cd api && uv run pytest -m integration` | live tests against Yahoo Finance |
| `supabase test db --linked` | pgTAP row-level-security tests against the linked project |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and the build on every push
and pull request. The live-network jobs (API integration and Playwright) run weekly and on
manual dispatch so Yahoo throttling never blocks a merge.

## Deployment

### API on Render (recommended) or Railway

`render.yaml` is a Render blueprint: **New → Blueprint → pick this repo** builds
`api/Dockerfile`, checks `/health`, and redeploys on every push to `main`. Set one secret in
the Render dashboard:

| Variable | Value |
|---|---|
| `STOCK_API_CORS_ORIGINS` | comma-separated exact browser origins; `render.yaml` sets the custom domain `https://pandagenticsignal.com` (+ `www`) and local dev |
| `STOCK_API_CORS_ORIGIN_REGEX` | optional; `https://.*\.lovable\.app` allows every Lovable preview and published subdomain (set in `render.yaml`) |

Optional: `STOCK_API_RATE_LIMIT` (default `120/minute` per client IP), `STOCK_API_SIMULATE_RATE_LIMIT` (default `30/minute`, its own window for `POST /portfolio/simulate`), `STOCK_API_COINGECKO_API_KEY` (free demo key, raises CoinGecko's public limit), `STOCK_API_LOG_LEVEL`.

AI news sentiment (`/sentiment/*`) is off until `ANTHROPIC_API_KEY` (or `STOCK_API_ANTHROPIC_API_KEY`) is set; `render.yaml` declares it with `sync: false`, so paste the value in the service's Environment tab. Tunables: `STOCK_API_SENTIMENT_MODEL` (default `claude-opus-5`), `STOCK_API_SENTIMENT_EFFORT` (`low`/`medium`/`high`), `STOCK_API_SENTIMENT_TTL` (default 3600 s per symbol), `STOCK_API_NEWS_TTL` (900 s), `STOCK_API_SENTIMENT_RATE_LIMIT` (default `10/minute`, own window). Each uncached report is one paid model call, roughly 3–5 ¢.
The free plan spins down after ~15 min idle (first request then takes ~30 s); the Starter plan
keeps it warm. Railway works the same way: create a service from the repo, set the root
directory to `api`, and add the same variables. Both inject `PORT`, which the image honours.

Build the image locally with `docker build -t stock-tool-api api && docker run -p 8000:8000 stock-tool-api`.

### Frontend on Lovable

1. Lovable links to a repo it creates: start a blank Lovable project, connect GitHub from its
   settings, then push this code into the repo Lovable made (that repo is now the canonical one,
   `MWPerrineJr/PandagenticSignal`). Lovable's own *Import from GitHub* works too if offered.
2. Every push to `main` shows up in Lovable and rebuilds the preview; Lovable's edits come back as
   commits. Never force-push or rewrite pushed history (see `AGENTS.md`).
3. No env vars to enter: the committed root `.env` already points at the Render API and the
   Supabase project. Lovable builds with `npm run build:dev`, which `package.json` provides.
4. Connect Lovable's Supabase integration to the same project so `supabase/migrations` stays the
   single source of truth for the schema.
5. `render.yaml` sets `STOCK_API_CORS_ORIGIN_REGEX` to allow `*.lovable.app` and lists the custom
   domain (`pandagenticsignal.com`) in `STOCK_API_CORS_ORIGINS`; add new domains there.

Any static host (Vercel, Netlify, Cloudflare Pages) works too: `npm run build` and serve `dist/`
with SPA fallback to `index.html`.

### Supabase

Schema and RLS live in `supabase/migrations/`; see `supabase/README.md` for linking a project,
pushing migrations and running the pgTAP tests. New projects need the migrations applied before
the first sign-in.

## Project layout

```
src/                 React app
  app/               routes, providers
  auth/              AuthProvider
  features/          search, quote, charts, watchlist, analysts, dashboard (+ widgets), auth
  lib/               API client + schemas, hooks, chart data, dashboard layout model, repos
  stores/            zustand stores for signed-out state
  test/              MSW handlers/fixtures, chart and Supabase fakes, render helper
api/app/             FastAPI app: routers/, services/, schemas, settings, ratelimit, logging
api/tests/           unit/ (mocked) and integration/ (live network)
supabase/            migrations, pgTAP tests
e2e/                 Playwright smoke test
.github/workflows/   CI
session.md           phase log
```

## Environment variables

Frontend: the root `.env` is **committed** and holds the hosted defaults (`VITE_API_URL` = the
Render API, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` = the browser-safe publishable key).
Lovable has no env-var UI, so this file is what its builds use. For local work put overrides in
`.env.local` (gitignored), typically `VITE_API_URL=http://localhost:8000`; leave the Supabase pair
blank there to run without accounts. `VITE_SUPABASE_PUBLISHABLE_KEY` (the name Lovable's Supabase
connector writes) is accepted as an alias.
API (`api/.env`, prefix `STOCK_API_`): `CORS_ORIGINS`, `CORS_ORIGIN_REGEX`, `RATE_LIMIT`, `SIMULATE_RATE_LIMIT`,
`SENTIMENT_RATE_LIMIT`, `RATE_LIMIT_ENABLED`, `LOG_FORMAT` (`text`|`json`), `LOG_LEVEL`, `COINGECKO_API_KEY` (optional),
`ANTHROPIC_API_KEY` (optional, also read without the prefix; enables `/sentiment`), `SENTIMENT_MODEL`, cache TTLs (see `api/app/settings.py`).

Data sources: Yahoo Finance via yfinance for stocks, ETFs and search; Coinbase's public market API for
crypto prices and candles; CoinGecko's public API for the crypto market-cap ranking. All keyless.
News sentiment reads Yahoo's headline feed and asks Claude (Anthropic API, paid, needs a key) for a
structured tone summary, cached per symbol for an hour. It is a summary of coverage, not advice.
