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
11. **Phase 1 checkpoint (see below).** ruff clean, 60 unit tests pass, coverage 99% (`fail_under` 80), 7/7 live integration tests pass in ~4 s. First live run had 2 transient failures (Yahoo throttling made `history` return empty → 404, and `recommendations_summary` came back empty); a rerun was clean. Frontend checks unchanged and green.
12. **Phase 2 built (2026-09-07).** shadcn `input`, `badge`, `card`, `skeleton` added (plus `cmdk` for the combobox; the shadcn `command`/`popover`/`dialog` wrappers were removed as unused). Typed API client with zod schemas mirroring the Python models, react-query hooks, ticker-in-URL hook (`?t=`), zustand tracked-tickers store (localStorage), dark-default `ThemeProvider`, app shell with four routed tabs that preserve the query string, `TickerSearch` combobox, dashboard `QuoteCard`, placeholder Charts/Analysts pages, Watchlist listing the tracked symbols.
13. **Phase 2 checkpoint.** tsc clean, oxlint clean (only the shadcn fast-refresh warnings), vitest 38/38, coverage 90% on `src/lib` + `src/features`, vite build OK. Verified in Chrome against the live API: dashboard quote for AAPL, search "nv" → Enter selects NVDA and updates URL + quote, Track → Watchlist shows NVDA, theme toggle works, no console errors.
14. **Phase 2 combobox bug found only in the browser, fixed.** cmdk keeps its highlighted value from the previous result set, so after typing "n" (highlight NSAIR) then "v", nothing was highlighted and Enter did nothing. Fix: the highlight is derived per result set (first result by default, arrow keys override) and the component owns the Enter key. Tests added for the two-query sequence and arrow-key selection.
15. **Phase 3 built (2026-09-07).** `lightweight-charts` 5.2.1 (v5 API: `addSeries(CandlestickSeries | LineSeries | HistogramSeries)`, `createPriceLine`, `subscribeCrosshairMove`). Pure mapping layer `src/lib/chart-data.ts` (type-only import of `Time`), URL-backed `useChartParams` (`period`, `interval`, `ov`), theme palettes, `PriceChart` (candles + volume pane + EMA lines + Bollinger dashed lines + S/R price lines labelled `S ×n`/`R ×n` + crosshair legend), `ChartControls` (period/interval radiogroups, overlay toggle buttons), `ChartsPage` wired to `useIndicators`. Charts route is lazy-loaded so the chart library lives in its own chunk (179 kB, main bundle unchanged).
16. **Phase 3 checkpoint (see below).** tsc + oxlint clean, vitest 64/64, coverage 95% (`src/lib` + `src/features`), build OK without the chunk-size warning. Verified in Chrome against the live API: AAPL 1Y daily renders all overlays; hovering updates the legend OHLC/EMA/BB values; toggling Bollinger removes the three lines; 6M + Weekly refetches and the URL carries `period`, `interval`, `ov`; light theme restyles the chart; no console errors.
17. **Phase 4 built (2026-09-07).** Loaded the `dataviz` skill first and validated colours with its palette checker: five categorical slots for compare mode (both modes pass), two-step blue and red arms for the diverging rating bar (ordinal checks pass; light red step re-picked at `#ee9291` because `#f2a09f` failed the 2:1 light-end floor). Values live in `src/lib/viz-palette.ts`. Watchlist tab: quote table over `/quotes` (price, change, volume, market cap, 1-month sparkline per row via `useHistory`), add via `TickerSearch`, move up/down, remove, row click opens Charts; store gained `move()`. Compare mode: `cmp` URL param (max 4 extra symbols), `useHistories` (`useQueries`), `normaliseSeries` rebases every series to 0% at the first *shared* bar, `CompareChart` (lightweight-charts line per symbol, % axis, zero baseline, legend follows crosshair), `ComparePicker` chips from tracked tickers plus a search box; overlays greyed out in compare mode. Analysts tab: consensus badge (weighted 5→1 mean, bucketed), KPI cards, diverging stacked bar per month centred on Hold (HTML segments, 2 px surface gaps, counts labelled only where they fit, hover tooltip, `<details>` table view), price-target track (low→high, mean/median dots, current-price tick, upside %), upgrades/downgrades table (direction icon + label, from → to, target change, show-all). API fix: Yahoo encodes missing price targets as 0 → now `null` (`_price`).
18. **Phase 4 checkpoint (see below).** API: ruff clean, pytest 60/60, 99%. Web: tsc + oxlint clean, vitest 93/93, coverage 95%, build OK. Verified in Chrome against the live API: Analysts AAPL (43 analysts, Hold 3.5/5, targets $215–$400, 50 grade changes), Watchlist add MSFT/AAPL via search with live rows and sparklines, compare AAPL vs MSFT vs NVDA over 6M with matching chip/line colours; no console errors.
19. **Phase 5 built (2026-09-07).** User created Supabase project **stock-tool-dev** (`agumrmsaeblcldcygajl`, us-east-2) in the existing org. Schema applied through the Supabase connector (`apply_migration` ×3) and mirrored in `supabase/migrations/`: `profiles`, `watchlists`, `watchlist_items`, `dashboard_layouts`, owner-only RLS on all four, `handle_new_user` trigger (profile + default watchlist on signup), `set_watchlist_items(uuid, text[])` RPC that replaces a list atomically (max 20, security invoker so RLS applies). Security advisor flagged the trigger function as API-callable → execute revoked; anon execute on the RPC revoked too. **RLS verified live** with two throwaway users via `execute_sql` (13 checks: own rows only, cross-user read/insert/update/RPC blocked, anon sees nothing; users deleted afterwards). pgTAP version of the same checks in `supabase/tests/0001_rls.test.sql`. Supabase CLI installed via brew (2.116.0); Docker not running, so `supabase test db` waits until the project is linked. Frontend: `@supabase/supabase-js` 2.115, `src/lib/supabase.ts` (null client when env is blank), `AuthProvider`/`useAuth`, `/login` (password sign-in, sign-up, magic link), header `UserMenu`, `watchlist-repo.ts` (default list lookup/create, list, RPC save), `useWatchlist()` hook that every page now uses: signed out → zustand/localStorage, signed in → Supabase with optimistic writes, one-time import of a non-empty local list into an empty cloud list per user. `.env` written locally with the publishable key (gitignored); `.env.example` documented.
20. **Phase 5 checkpoint (see below).** vitest 110/110 (in-memory Supabase fake wired globally in `src/test/setup.ts`; repo, hook incl. import + rollback, login flow, sign-out fallback), tsc + oxlint clean, build OK (main chunk now ~560 kB minified because supabase-js joined it; warning left visible on purpose). Browser: signed-out app runs against the real project (session check resolves, local watchlist intact, `/login` renders, no console errors). **Not verified by me:** actual sign-up/sign-in, since I don't enter credentials; the user does that step.
21. **User signed up** (one account on stock-tool-dev); the local watchlist (NVDA, MSFT, AAPL) was imported into the account on first sign-in as designed.
22. **Phase 6 built (2026-09-07).** `react-grid-layout` 2.2.4 (v2 API: `useContainerWidth`, `gridConfig`/`dragConfig`/`resizeConfig`, `verticalCompactor`). Layout model `src/lib/dashboard-layout.ts` (zod, `version: 1`, migration hook, widget config schemas with defaults, unknown widget types preserved, `addWidget`/`removeWidget`/`updateWidgetConfig`/`applyGrid`, starter layout = watchlist + chart + quote + analyst). Widget registry with five widgets (Quote, Chart, Watchlist, Analysts, Compare), each with a settings panel; Chart and Compare widgets are `React.lazy` so lightweight-charts stays out of the main bundle. `WidgetFrame` (title bar is the drag handle in edit mode, gear + remove). `useDashboard()` mirrors `useWatchlist()`: signed out → zustand store `stock-tool.dashboard`; signed in → `dashboard_layouts` rows, seeded from the local active layout on first sign-in, active selection remembered per user in localStorage. Edits apply instantly and persist after 1 s of quiet (`SAVE_DEBOUNCE_MS`), flushed on Done/unmount/switch. Toolbar: layout picker, Edit layout/Done, Add widget menu, New/Rename/Make default/Delete layout (window.prompt/confirm for now).
23. **Phase 6 checkpoint.** vitest 130/130 (layout round-trip + version + unknown type, registry resolves every type, debounced save fires once with fake timers, flush, cloud seeding + save, page add/configure/remove/switch), coverage 93% lines, tsc + oxlint clean, build OK (chart library in its own chunk; main chunk ~800 kB minified with supabase-js + react-grid-layout, warning left visible). Browser, signed in against the real project: starter widgets render with live data; Add widget → Compare appears with live lines; reload keeps it (row in Supabase); resize watchlist 10 → 7 rows persisted with the quote widget compacted beneath. The Chrome extension's synthetic drag does not reach react-draggable, so the resize was driven with real DOM mouse events from the page; the same wiring is unit-tested.

## Repository state

```
stock-tool/                                   git main (revert points: b71a2fd, 6c27385)
  README.md  session.md  .pre-commit-config.yaml  .env.example  .gitignore
  index.html  vite.config.ts  tsconfig{,.app,.node}.json  package.json  components.json
  public/favicon.svg
  src/
    App.tsx  App.test.tsx  main.tsx  index.css
    app/{routes,providers}.tsx              routes + QueryClient/Theme/Auth providers
    auth/auth-provider.tsx                  AuthProvider + useAuth
    features/auth/login-page.tsx (+test)
    components/layout/user-menu.tsx
    components/{theme-provider,theme-toggle}.tsx
    components/layout/app-shell.tsx         header, nav tabs, TickerSearch
    components/ui/{button,input,badge,card,skeleton}.tsx
    features/search/ticker-search.tsx (+test)
    features/quote/quote-card.tsx
    features/charts/{charts-page,price-chart,chart-controls,compare-chart,compare-picker}.tsx (+tests)
    features/watchlist/{watchlist-page,sparkline}.tsx (+test)
    features/analysts/{analysts-page,recommendation-bars,price-target-gauge,grade-table}.tsx (+test)
    features/dashboard/{dashboard-page,dashboard-grid}.tsx (+test)
    features/dashboard/widgets/{registry,widget-frame,settings-fields,unknown-widget}.tsx (+test)
    features/dashboard/widgets/{quote,chart,watchlist,analyst,compare}-widget.tsx
    features/empty-ticker.tsx
    lib/api.ts (zod schemas + fetchers)  lib/queries.ts (hooks)  lib/use-ticker.ts
    lib/chart-data.ts (API rows → series)  lib/use-chart-params.ts  lib/chart-theme.ts
    lib/viz-palette.ts (validated colours)  lib/compare.ts  lib/analysts.ts
    lib/supabase.ts  lib/watchlist-repo.ts  lib/use-watchlist.ts  (+tests)
    lib/dashboard-layout.ts  lib/dashboard-repo.ts  lib/use-dashboard.ts  (+tests)
    stores/dashboard.ts (signed-out layouts)
    lib/use-debounce.ts  lib/format.ts  lib/utils.ts  (+tests)
    stores/tickers.ts (+test)
    test/{setup,server,handlers,fixtures}.ts  test/render.tsx  test/chart-mock.ts  test/supabase-mock.ts
  supabase/
    README.md  migrations/{20260907130000_init,20260907130100_lock_down_functions}.sql
    tests/0001_rls.test.sql                (pgTAP)
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
| `aa8bebd` | Phase 1 closed: data API |
| `b9214ab` | Phase 2 closed: frontend foundation and ticker search |
| `f3f0b3f` | Phase 3 closed: Charts tab |
| `1c7e736` | Phase 4 closed: watchlist, compare mode, Analysts tab |
| `6d1f4b7` | Phase 5 closed: Supabase auth and persistence |
| (next) | Phase 6 closed: customizable dashboard |

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
- [x] App shell with tabs Dashboard · Charts · Watchlist · Analysts (react-router), dark theme default
- [x] `src/lib/api.ts` typed client (zod) + `src/lib/queries.ts` react-query hooks
- [x] `TickerSearch` combobox (name or symbol, debounced 250 ms, keyboard nav, Enter on raw text), ticker in `?t=`
- [x] Zustand tracked-tickers store (localStorage, max 20)
- [x] **Test checkpoint:** vitest 38/38 (TickerSearch with MSW, schema parsing, hooks, routing, store), tsc + oxlint clean, build OK, live browser check

### Phase 3 — Charts tab with technical indicators
- [x] lightweight-charts candlestick + volume histogram pane
- [x] Overlays: EMA 10/30/60/90 (distinct colours), Bollinger Bands (dashed upper/lower, dotted middle), support/resistance price lines labelled with touch count
- [x] Period (1M–5Y) / interval (Daily, Weekly) / overlay toggles persisted in URL (`period`, `interval`, `ov`; defaults omitted)
- [x] Crosshair legend with OHLC, volume and active indicator values
- [x] Lazy-loaded route (chart library in its own chunk)
- [x] **Test checkpoint:** vitest 64/64 (mapping helpers, URL round-trip, chart component against a mocked chart lib, page with MSW), tsc + oxlint clean, build OK, live browser check

### Phase 4 — Multi-stock tracking and Analysts tab
- [x] Watchlist tab: live quote table, sparklines, add/remove/reorder (localStorage until Phase 5)
- [x] Compare mode (normalised % change from first shared bar, up to 5 tickers, `cmp` URL param)
- [x] Analysts tab: consensus badge, diverging rating bars with table view, price-target track, upgrades/downgrades table, no-coverage state
- [x] Colours validated with the dataviz palette checker
- [x] **Test checkpoint:** vitest 93/93, pytest 60/60, tsc + oxlint + ruff clean, build OK, live browser check

### Phase 5 — Supabase auth and persistence
- [x] Supabase CLI + project (`stock-tool-dev`), env vars
- [x] Migrations: profiles, watchlists, watchlist_items, dashboard_layouts, RLS, signup trigger, `set_watchlist_items` RPC
- [x] Auth UI (`/login`: password, sign-up, magic link) + header user menu. **Deviation from plan:** no hard route guard; Dashboard and Watchlist stay usable signed-out with the local list and show a "Sign in to sync" hint. A wall would have thrown away the working localStorage flow for no gain.
- [x] `useWatchlist()` over Supabase with optimistic writes; one-time localStorage import on first sign-in
- [x] **Test checkpoint:** vitest 110/110 with an in-memory Supabase fake; RLS verified live via SQL (13 checks); pgTAP file ready for `supabase test db --linked`
- [x] **User step:** signed up; watchlist synced

### Phase 6 — Customizable dashboard
- [x] react-grid-layout v2 grid, edit mode (drag by title bar, resize from corner, add/remove)
- [x] Widget registry: Watchlist, Chart, Quote, Analyst, Compare, each with settings; unknown type → placeholder
- [x] Layout persistence (jsonb, 1 s debounce, flush on Done), named layouts with default, starter layout, local ↔ cloud seeding
- [x] **Test checkpoint:** vitest 130/130, tsc + oxlint clean, build OK, live browser check incl. Supabase round trip

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

- The shadcn Base UI components import `cn` from the `cn` npm package rather than `@/lib/utils`; both exist, app code uses `@/lib/utils`.
- Retry policy lives on the app `QueryClient` (`makeQueryClient`), not on hooks, so tests can disable it. 404s are never retried.
- Bollinger Bands are drawn as three lines, not a filled band; a fill needs a custom series primitive in lightweight-charts v5. Revisit if wanted.
- Daily chart times are `yyyy-mm-dd` computed from the UTC timestamp shifted by +12 h, which is correct for exchange offsets in (−12 h, +12 h]. NZ/Kiribati summer time (+13/+14) would be off by a day; fix by emitting a local date from the API if it matters.
- With short windows (e.g. 1M daily, 6M weekly) support/resistance has few extrema and mostly `×1` levels; the API's `order=5` could scale with bar count later.
- Layout tools use `window.prompt`/`window.confirm` for new/rename/delete. Fine for now; a shadcn Dialog would be the polish item (Phase 7 or later).
- Widgets that pin a symbol keep it; blank symbol follows the header ticker. The `subtitle` in the title bar shows which is in effect.
- The grid uses `static: !editing` on every item outside edit mode, so nothing moves accidentally; `onLayoutChange` is ignored unless editing.
- Supabase auth defaults to **email confirmation on**: password sign-up sends a confirmation email (built-in sender, a few per hour). For development, Authentication → Providers → Email → "Confirm email" can be switched off in the dashboard; the app already handles both cases (`needsConfirmation`).
- The publishable key (`sb_publishable_…`) is used instead of the legacy anon JWT; both are safe in the browser, RLS is the real boundary.
- `useWatchlist` calls the cloud queries unconditionally with `enabled` flags so hook order is stable; the local-vs-cloud branch happens on the return value.
- Compare-mode colours follow list position (primary = slot 1, then `cmp` order). Removing a middle symbol repaints the ones after it; acceptable for ≤5 lines, but if it bothers users, pin a slot per symbol in the URL.
- The consensus label uses a weighted mean bucketed at 4.5/3.5/2.5/1.5; AAPL's live mix (6/18/13/3/3) lands on Hold at 3.49, which surprises people who expect "Buy". Consider Yahoo's own `recommendationKey` from `Ticker.info` if that matters.
- The combobox renders cmdk primitives directly with an absolutely positioned panel (no Base UI Popover) so focus and jsdom behave predictably.

## Next actions

1. **Phase 7** — Hardening, deployment, Lovable import. Order: (a) API `Dockerfile` + `slowapi` rate limiting + CORS from env + `/health` used by the host; deploy to Render or Railway (user picks; needs an account and will ask for env vars `STOCK_API_CORS_ORIGINS`); (b) Playwright E2E smoke (search → chart → watchlist → analysts) against the dev servers, plus a CI job; (c) `gh repo create` + push (CI runs), then Lovable import via GitHub with `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; (d) README architecture + run + deploy sections; (e) optional Supabase edge-function proxy if the API host needs hiding; (f) final checkpoint. Optional polish first: replace `window.prompt`/`confirm` in the dashboard toolbar with dialogs. Optional: `supabase link --project-ref agumrmsaeblcldcygajl` then `supabase test db --linked` for the pgTAP RLS tests.
2. Optional: move `api/app/stock-tool.code-workspace` to the repo root (adjust `path` to `.`).
3. Optional: `pip install pre-commit && pre-commit install`; `gh repo create` and push so CI runs (otherwise Phase 7).
