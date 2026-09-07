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
                │      in-process cache, per-IP rate limit, JSON logs
                │
                └──► Supabase (auth, watchlists, dashboard layouts)   ← supabase/migrations, RLS
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
cp .env.example .env          # add the Supabase URL + publishable key to enable accounts
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
| `STOCK_API_CORS_ORIGINS` | comma-separated browser origins, e.g. `https://your-app.lovable.app,http://localhost:5173` |

Optional: `STOCK_API_RATE_LIMIT` (default `120/minute` per client IP), `STOCK_API_LOG_LEVEL`.
The free plan spins down after ~15 min idle (first request then takes ~30 s); the Starter plan
keeps it warm. Railway works the same way: create a service from the repo, set the root
directory to `api`, and add the same variables. Both inject `PORT`, which the image honours.

Build the image locally with `docker build -t stock-tool-api api && docker run -p 8000:8000 stock-tool-api`.

### Frontend on Lovable

1. Push the repo to GitHub.
2. In Lovable choose **Import from GitHub** and pick the repository (the Vite project is at the root).
3. Add the environment variables: `VITE_API_URL` (the Render URL), `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` (the `sb_publishable_…` key).
4. Connect Lovable's Supabase integration to the same project so `supabase/migrations` stays the
   single source of truth for the schema.
5. Add the Lovable preview and published origins to `STOCK_API_CORS_ORIGINS` on Render.

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

Frontend (`.env`): `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (leave the
Supabase pair blank to run without accounts).
API (`api/.env`, prefix `STOCK_API_`): `CORS_ORIGINS`, `RATE_LIMIT`, `RATE_LIMIT_ENABLED`,
`LOG_FORMAT` (`text`|`json`), `LOG_LEVEL`, cache TTLs (see `api/app/settings.py`).
