# Session Log — Stock Analysis Tool

Last updated: 2026-09-06

## Conversation summary

1. **Goal set.** Build a stock analysis app: yfinance data, ticker/company-name search dropdown, chart tab with EMA 10/30/60/90, Bollinger Bands, support/resistance, multi-stock tracking, customizable dashboard (watchlist + widgets), analyst-recommendations tab, unit tests at regular intervals, deployable on Lovable.
2. **Constraint identified.** Lovable only runs React + Vite + TypeScript + Tailwind + shadcn/ui with Supabase (Deno edge functions). yfinance is Python and cannot run inside Lovable.
3. **Decisions made by the user.**
   - Data layer: **Python-first, Lovable later.** FastAPI + yfinance service in `api/`, React frontend at the repo root in Lovable's exact stack, import into Lovable via GitHub once the API is stable.
   - Persistence: **Supabase with user accounts** for watchlists and dashboard layouts.
4. **Plan approved.** Eight phases (0–7) with a test checkpoint at the end of each. Full plan: `~/.claude/plans/elegant-imagining-mitten.md`.
5. **Phase 0 started.** Repo initialised, frontend and API scaffolded, test tooling and CI written. Work paused before writing the pre-commit config and README, and before running either test suite.

## Repository state

```
stock-tool/
  index.html  vite.config.ts  tsconfig*.json  package.json  .env.example  .gitignore
  src/  App.tsx  App.test.tsx  main.tsx  index.css  test/{setup,server,handlers}.ts
  api/  pyproject.toml  .env.example  app/{__init__,main,settings}.py  tests/{conftest.py,unit/test_health.py,integration/}
  .github/workflows/ci.yml
```

Toolchain: Node 24.18, Vite 8, React 19, TypeScript 6, Tailwind 4, vitest 5, MSW 2; Python 3.12 via uv, FastAPI, yfinance 1.7.0, pandas 3.0.5.

## Phase checklist

### Phase 0 — Scaffold and tooling
- [x] Remove empty `StockAnalysisTool/`, `git init` on `main`, `.gitignore`
- [x] Vite React + TS scaffold at repo root (Lovable requirement)
- [x] Tailwind v4 via `@tailwindcss/vite`, `@/` path alias in Vite and tsconfig
- [x] Runtime deps: react-router-dom, @tanstack/react-query, zod, zustand, lucide-react, cva, clsx, tailwind-merge
- [x] Test deps: vitest, @testing-library/react + jest-dom + user-event, jsdom, msw; `src/test/setup.ts` with MSW server
- [x] Smoke test `src/App.test.tsx`
- [x] `npm` scripts: dev, build, typecheck, lint, test, test:coverage
- [ ] `npx shadcn@latest init` (theme tokens such as `bg-background` are referenced in `App.tsx` but not yet defined)
- [x] `uv init api --python 3.12`; deps fastapi, uvicorn, yfinance, pandas, numpy, scipy, cachetools, pydantic-settings; dev deps pytest, pytest-cov, pytest-asyncio, httpx, ruff
- [x] `pyproject.toml` pytest config (integration marker excluded by default), coverage `fail_under = 80`, ruff rules
- [x] `app/main.py` with `create_app()`, CORS, `GET /health`; `app/settings.py` (env prefix `STOCK_API_`)
- [x] `tests/conftest.py` TestClient fixture; `tests/unit/test_health.py`
- [x] `.env.example` for both frontend and API
- [x] `.github/workflows/ci.yml` — api job (ruff, pytest+cov), web job (lint, typecheck, vitest, build), weekly scheduled live-integration job
- [ ] `.pre-commit-config.yaml` (write was interrupted, not created)
- [ ] `README.md`
- [ ] **Test checkpoint:** run `cd api && uv run pytest` and `npm test`, `npm run typecheck`, `npm run build` — not yet executed
- [ ] Initial git commit

### Phase 1 — Data API (FastAPI + yfinance)
- [ ] `services/cache.py` TTL cache
- [ ] `services/market_data.py` yfinance wrapper
- [ ] `services/indicators.py` — `ema`, `bollinger` (pure pandas)
- [ ] `services/levels.py` — `support_resistance` (extrema + clustering)
- [ ] Routers: `/search`, `/quote/{ticker}`, `/quotes`, `/history/{ticker}`, `/indicators/{ticker}`, `/recommendations/{ticker}`
- [ ] Error handling: unknown ticker → 404, yfinance failure → 502
- [ ] Unit tests with fixture DataFrames (no network); one `@pytest.mark.integration` test per endpoint
- [ ] Test checkpoint (coverage ≥ 80% on `app/services`)

### Phase 2 — Frontend foundation and ticker search
- [ ] App shell with tabs Dashboard · Charts · Watchlist · Analysts (react-router), dark theme default
- [ ] `src/lib/api.ts` typed client + react-query hooks
- [ ] `TickerSearch` combobox (name or symbol, debounced, keyboard nav), ticker in URL params
- [ ] Zustand "active tickers" store
- [ ] Test checkpoint (TickerSearch with MSW, schema parsing, routing)

### Phase 3 — Charts tab with technical indicators
- [ ] lightweight-charts candlestick + volume
- [ ] Overlays: EMA 10/30/60/90, Bollinger Bands, support/resistance lines
- [ ] Period / interval / toggle controls persisted in URL
- [ ] Crosshair tooltip
- [ ] Test checkpoint

### Phase 4 — Multi-stock tracking and Analysts tab
- [ ] Watchlist tab (localStorage until Phase 5)
- [ ] Compare mode (normalised % change, up to 5 tickers)
- [ ] Analysts tab: recommendation history chart, price-target gauge, upgrades/downgrades table
- [ ] Test checkpoint

### Phase 5 — Supabase auth and persistence
- [ ] Supabase CLI + project, env vars
- [ ] Migration `0001_init.sql`: profiles, watchlists, watchlist_items, dashboard_layouts, RLS
- [ ] Auth UI + route guard
- [ ] Watchlist hooks over Supabase, localStorage migration on first sign-in
- [ ] Test checkpoint (pgTAP RLS tests, mocked client hooks)

### Phase 6 — Customizable dashboard
- [ ] react-grid-layout grid, edit mode
- [ ] Widget registry: Watchlist, Chart, Quote, Analyst, Compare
- [ ] Layout persistence (jsonb, debounced), named layouts, starter layout
- [ ] Test checkpoint

### Phase 7 — Hardening, deployment, Lovable import
- [ ] API Dockerfile, deploy (Render/Railway), rate limiting, CORS lockdown
- [ ] Optional Supabase edge-function proxy
- [ ] Playwright E2E smoke
- [ ] GitHub push, Lovable import, env vars, Supabase integration
- [ ] README with architecture and run instructions
- [ ] Final test checkpoint

## Next actions

1. Run `npx shadcn@latest init -d` to add theme tokens and `components/ui`.
2. Write `.pre-commit-config.yaml` and `README.md`.
3. Run both test suites and the typecheck/build to close the Phase 0 checkpoint.
4. Make the initial commit and start Phase 1.
