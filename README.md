# Stock Analysis Tool

A trader-facing stock analysis web app: ticker/company search, candlestick charts with
technical indicators (EMA 10/30/60/90, Bollinger Bands, support/resistance), multi-stock
tracking, a customizable dashboard with watchlist and chart widgets, and analyst
recommendations. Market data comes from [yfinance](https://github.com/ranaroussi/yfinance).

## Architecture

```
Browser ──► React app (repo root, Vite + TS + Tailwind + shadcn/ui)   ← imported into Lovable
                │
                ├──► FastAPI + yfinance service (api/)                ← hosted on Render/Railway
                │
                └──► Supabase (auth, watchlists, dashboard layouts)   ← supabase/migrations
```

The frontend lives at the repository root because Lovable's GitHub import expects a Vite
project there. The Python API cannot run inside Lovable, so it is deployed separately.

## Local development

Prerequisites: Node 24, [uv](https://docs.astral.sh/uv/), and (from Phase 5) the Supabase CLI.

```bash
# Frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173

# API
cd api
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload   # http://localhost:8000, docs at /docs
```

## Testing

| Command | What it runs |
|---|---|
| `npm test` | vitest unit/component tests (MSW mocks the API) |
| `npm run typecheck` / `npm run lint` / `npm run build` | TypeScript, oxlint, production build |
| `cd api && uv run pytest` | Python unit tests, no network (integration tests excluded by default) |
| `cd api && uv run pytest -m integration` | Live tests against Yahoo Finance |
| `cd api && uv run pytest --cov` | Unit tests with coverage, fails under 80% |

Cadence: pre-commit hooks run lint plus fast unit tests on every commit
(`pip install pre-commit && pre-commit install`), GitHub Actions runs the full suites on every
push and pull request, and a weekly scheduled job runs the live integration tests to catch
yfinance or Yahoo API drift.

## Project layout

```
src/                 React app: components/, features/, lib/, test/
api/app/             FastAPI app: routers/, services/, schemas.py, settings.py
api/tests/           unit/ (mocked) and integration/ (live network)
supabase/            migrations and edge functions (Phase 5+)
.github/workflows/   CI
session.md           phase checklist and session log
```

## API

Endpoint reference, error codes and module layout: [`api/README.md`](api/README.md).

## Environment variables

Frontend (`.env`): `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
API (`api/.env`, prefix `STOCK_API_`): `STOCK_API_CORS_ORIGINS` and cache TTL overrides
(see `api/app/settings.py`).
