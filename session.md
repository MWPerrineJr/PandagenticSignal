# Session Log — Stock Analysis Tool

Last updated: 2026-09-07

## Conversation summary

1. **Goal set.** Build a stock analysis app: yfinance data, ticker/company-name search dropdown, chart tab with EMA 10/30/60/90, Bollinger Bands, support/resistance, multi-stock tracking, customizable dashboard (watchlist + widgets), analyst-recommendations tab, unit tests at regular intervals, deployable on Lovable.
2. **Constraint identified.** Lovable only runs React + Vite + TypeScript + Tailwind + shadcn/ui with Supabase (Deno edge functions). yfinance is Python and cannot run inside Lovable.
3. **Decisions made by the user.**
   - Data layer: **Python-first, Lovable later.** FastAPI + yfinance service in `api/`, React frontend at the repo root in Lovable's exact stack, import into Lovable via GitHub once the API is stable.
   - Persistence: **Supabase with user accounts** for watchlists and dashboard layouts.
4. **Plan approved.** Eight phases (0–7) with a test checkpoint at the end of each. Full plan: `~/.claude/plans/elegant-imagining-mitten.md`.
5. **Phase 0 started.** Repo initialised, frontend and API scaffolded, test tooling and CI written. User paused work to review progress; `session.md` created.
6. **GitHub check.** User asked whether GitHub login is needed. Answer: no, `gh` is already authenticated (account MWPerrineJr, `repo` + `workflow` scopes). Nothing is pushed yet; git identity for commits is the yahoo address, changeable per repo on request.
7. **Checkpoint commit `b71a2fd`** made at the user's request as a revert point (38 files, lockfiles included, no `node_modules`/`.venv`/`.env`).
8. **Phase 0 finished, commit `6c27385`.** shadcn/ui init (Base UI, Geist font, theme tokens, Button, `cn`), pre-commit config, README, vitest coverage provider. Fixes: dropped deprecated tsconfig `baseUrl` (TypeScript 6 error), `__dirname` → `import.meta.dirname` in `vite.config.ts`, page title set, Vite scaffold assets removed. All checks green.
9. **User commits after the session.** `754f1ea` (session.md tweak, message "removed unnecessary file") and `ebf26f7` (VS Code workspace file added at `api/app/stock-tool.code-workspace`; it points at the repo root, so it works from there but would normally live at the repo root, not inside the Python package).
10. **Phase 1 built (2026-09-07).** Live probe of yfinance 1.7.0 to confirm shapes (`fast_info` keys, `recommendations_summary`, `analyst_price_targets`, `upgrades_downgrades`, `Search.quotes`; unknown ticker → `fast_info` raises `KeyError`, `history` returns an empty frame). Then cache → indicators → levels → market_data → schemas → routers → error handlers, each with tests. Pandas 3 gotcha fixed: `date_range` defaults to microsecond resolution, so epoch seconds are computed with Timedelta division rather than `astype("int64") // 1e9`. Ruff B008 fixed by using `Annotated[MarketData, Depends(...)]` (`MarketDataDep`).
11. **Phase 1 checkpoint.** ruff clean, 60 unit tests pass, coverage 99% (`fail_under` 80), 7/7 live integration tests pass in ~4 s. First live run had 2 transient failures (Yahoo throttling made `history` return empty → 404, and `recommendations_summary` came back empty); a rerun was clean. Frontend checks unchanged and green.

## Repository state

```
stock-tool/                                   git main (revert points: b71a2fd, 6c27385)
  README.md  session.md  .pre-commit-config.yaml  .env.example  .gitignore
  index.html  vite.config.ts  tsconfig{,.app,.node}.json  package.json  components.json
  public/favicon.svg
  src/
    App.tsx  App.test.tsx  main.tsx  index.css
    components/ui/button.tsx
    lib/utils.ts
    test/{setup,server,handlers}.ts
  api/
    pyproject.toml  uv.lock  .python-version  .env.example  README.md (endpoint reference)
    app/{__init__,main,settings,deps,errors,schemas}.py
    app/stock-tool.code-workspace          (user-added VS Code workspace)
    app/routers/{search,quotes,history,recommendations}.py
    app/services/{cache,indicators,levels,market_data}.py
    tests/conftest.py  tests/fakes.py       (FakeYF: in-memory yfinance stand-in)
    tests/unit/test_{health,cache,indicators,levels,market_data,routers}.py
    tests/integration/test_live.py         (@integration, 7 tests, AAPL)
  .github/workflows/ci.yml
```

Commits:

| Hash | Purpose |
|---|---|
| `b71a2fd` | Phase 0 scaffold, requested as a revert point |
| `6c27385` | Phase 0 closed: shadcn, pre-commit, README, checks green |
| `754f1ea`, `ebf26f7` | User: session.md tweak, VS Code workspace file |
| (next) | Phase 1 closed: data API |

Toolchain: Node 24.18, Vite 8, React 19, TypeScript 6, Tailwind 4, shadcn (Base UI), vitest 5, MSW 2; Python 3.12 via uv, FastAPI, yfinance 1.7.0, pandas 3.0.5. GitHub CLI authenticated; no remote configured yet.

## Phase checklist

### Phase 0 — Scaffold and tooling
- [x] Remove empty `StockAnalysisTool/`, `git init` on `main`, `.gitignore`
- [x] Vite React + TS scaffold at repo root (Lovable requirement)
- [x] Tailwind v4 via `@tailwindcss/vite`, `@/` path alias in Vite and tsconfig
- [x] Runtime deps: react-router-dom, @tanstack/react-query, zod, zustand, lucide-react, cva, clsx, tailwind-merge
- [x] Test deps: vitest, @testing-library/react + jest-dom + user-event, jsdom, msw; `src/test/setup.ts` with MSW server
- [x] Smoke test `src/App.test.tsx`
- [x] `npm` scripts: dev, build, typecheck, lint, test, test:coverage
- [x] `npx shadcn@latest init` (Base UI, Geist font, theme tokens, `components/ui/button.tsx`, `lib/utils.ts`)
- [x] `uv init api --python 3.12`; deps fastapi, uvicorn, yfinance, pandas, numpy, scipy, cachetools, pydantic-settings; dev deps pytest, pytest-cov, pytest-asyncio, httpx, ruff
- [x] `pyproject.toml` pytest config (integration marker excluded by default), coverage `fail_under = 80`, ruff rules
- [x] `app/main.py` with `create_app()`, CORS, `GET /health`; `app/settings.py` (env prefix `STOCK_API_`)
- [x] `tests/conftest.py` TestClient fixture; `tests/unit/test_health.py`
- [x] `.env.example` for both frontend and API
- [x] `.github/workflows/ci.yml` — api job (ruff, pytest+cov), web job (lint, typecheck, vitest, build), weekly scheduled live-integration job
- [x] `.pre-commit-config.yaml`
- [x] `README.md`
- [x] **Test checkpoint:** ruff clean, pytest 1/1 with 100% coverage; oxlint clean (1 shadcn warning), tsc clean, vitest 1/1, vite build OK
- [x] Commits: `b71a2fd` (scaffold / revert point), `6c27385` (Phase 0 closed)

### Phase 1 — Data API (FastAPI + yfinance)
- [x] `services/cache.py` namespaced TTL cache (cachetools, injectable timer, thread-safe)
- [x] `services/market_data.py` yfinance wrapper (`MarketData` class, yfinance module injectable)
- [x] `services/indicators.py` — `ema`, `sma`, `bollinger`, `compute_emas` (pure pandas)
- [x] `services/levels.py` — `support_resistance` (scipy `argrelextrema` + tolerance clustering, kind relative to last close)
- [x] Routers: `/search`, `/quote/{ticker}`, `/quotes`, `/history/{ticker}`, `/indicators/{ticker}`, `/recommendations/{ticker}`
- [x] Error handling: unknown ticker → 404, yfinance failure → 502, rate limit → 503 + `Retry-After`, bad period/interval → 422
- [x] Unit tests with fixture DataFrames (no network); one `@pytest.mark.integration` test per endpoint
- [x] **Test checkpoint:** ruff clean, pytest 60/60, coverage 99%; integration 7/7 live

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

## Notes for later phases

- `/history` and `/indicators` emit `time` as Unix seconds UTC. lightweight-charts wants `yyyy-mm-dd` strings for daily bars to avoid timezone date shifts; convert on the frontend in Phase 3 when `interval` is `1d` or coarser.
- yfinance returns an empty frame both for unknown tickers and for transient throttling, so a throttled `/history` call reads as 404. Consider a retry in `MarketData._history` in Phase 7 if it shows up in practice.
- `/quotes` fans out to one `fast_info` call per symbol (cached 60 s). Fine for a watchlist of tens; revisit with `yf.download` batching if it becomes slow.
- Empty analyst data (ETFs, small caps) returns empty lists rather than 404; the symbol is only validated via `quote()` when all three datasets are missing.

## Next actions

1. **Phase 2** — frontend foundation: app shell with tabs (react-router, dark theme), `src/lib/api.ts` typed client with zod schemas mirroring `api/app/schemas.py`, react-query hooks, `TickerSearch` combobox against `/search`, Zustand active-tickers store, MSW handlers for every endpoint. Start the API with `cd api && uv run uvicorn app.main:app --reload` and set `VITE_API_URL=http://localhost:8000`.
2. Optional: move `api/app/stock-tool.code-workspace` to the repo root (adjust `path` to `.`).
3. Optional: `pip install pre-commit && pre-commit install`; `gh repo create` and push so CI runs (otherwise Phase 7).
