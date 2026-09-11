# Session Log — Stock Analysis Tool

Last updated: 2026-09-11 (late afternoon)

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
23. **Phase 6 checkpoint (see below).** vitest 130/130 (layout round-trip + version + unknown type, registry resolves every type, debounced save fires once with fake timers, flush, cloud seeding + save, page add/configure/remove/switch), coverage 93% lines, tsc + oxlint clean, build OK (chart library in its own chunk; main chunk ~800 kB minified with supabase-js + react-grid-layout, warning left visible). Browser, signed in against the real project: starter widgets render with live data; Add widget → Compare appears with live lines; reload keeps it (row in Supabase); resize watchlist 10 → 7 rows persisted with the quote widget compacted beneath. The Chrome extension's synthetic drag does not reach react-draggable, so the resize was driven with real DOM mouse events from the page; the same wiring is unit-tested.
24. **Phase 7 started (2026-09-07).** Host comparison given (Render free tier spins down when idle; Railway usage-billed, always warm); recommended Render. Host-independent work done first: per-IP rate limiting (`app/ratelimit.py`, moving window on the `limits` library, `X-RateLimit-*` headers, 429 + `Retry-After`, `/health` and docs exempt, keyed by first `X-Forwarded-For` hop), JSON structured logging + access log middleware (`app/logging_config.py`, `STOCK_API_LOG_FORMAT=json`), CORS `max_age`, `create_app(settings)` for tests, `api/Dockerfile` (uv image, non-root, honours `PORT`, healthcheck), `.dockerignore`, `render.yaml` blueprint, Playwright (`playwright.config.ts`, `e2e/smoke.spec.ts`: search → quote → chart overlays + URL → watchlist add/remove → analysts; unknown symbol errors; login rejects bad credentials), CI `e2e` job on schedule/dispatch, README rewritten with deploy + Lovable steps. **slowapi dropped:** FastAPI 0.141 registers routers lazily, so slowapi's middleware cannot resolve the route and its default limits silently never fire (verified: `_find_route_handler` returns None). The user committed the in-progress files as `6f244fe` ("updated files") mid-way; the follow-up commit completes them.
25. **Phase 7 checkpoint (partial).** pytest 69/69, 99%; vitest 130/130; tsc + oxlint clean; build OK; Playwright 3/3 against the live API in 13 s; live API returns rate-limit headers. **Not done yet (needs the user):** Docker image build (Docker Desktop not running), GitHub repo creation + push (outward-facing, needs go-ahead), Render deploy (needs the user's account), Lovable import, then re-running Playwright with `E2E_BASE_URL` against the deployed frontend. The optional Supabase edge-function proxy was skipped: the API is CORS-locked and rate-limited, and hiding its URL adds latency for no security gain with public market data.
26. **GitHub.** The user had already created **https://github.com/MWPerrineJr/stock-tool** (public) and pushed `6f244fe`; its CI run failed as expected (half-finished slowapi state). Pushed `0b77b56` + `f7b06fc`; CI run 34161028454 green (API 19 s, Web 47 s). `.env` confirmed not in the repo. Render account created by the user; blueprint deploy pending.
27. **Render live:** https://stock-tool-api-qg9s.onrender.com (free plan, Ohio, built from `api/Dockerfile`, so the image is verified without local Docker). Probed: `/health` 0.2 s, live `/quote/AAPL`, `/indicators/AAPL?period=6mo` (128 candles, 6 levels), `X-RateLimit-*` headers present, CORS header only for `http://localhost:5173`, 404 for unknown symbols. Playwright 3/3 against a frontend served on :5173 with `VITE_API_URL` = Render URL (a first run on :5174 failed purely because that origin is not in `STOCK_API_CORS_ORIGINS`). The dev server on :5173 is currently running with `VITE_API_URL` pointed at Render.

28. **Lovable (2026-09-08).** The user created Lovable project **Stock UI Builder** (`553ee360-dd3b-43d1-93f9-254d89ad2fc0`) with the chat prompt "import code from https://github.com/MWPerrineJr/stock-tool.git and start building the ui". Lovable ported the frontend into its own project (~53 files "Created", one plan `.md`), and the preview at `https://id-preview--553ee360-dd3b-43d1-93f9-254d89ad2fc0.lovable.app` renders Dashboard/Charts/Watchlist/Analysts in the repo's style. **It is a copy, not a GitHub link:** nothing was pushed to `MWPerrineJr/stock-tool` and no Lovable branch exists, so the two codebases will diverge unless the project is connected to GitHub (Lovable Settings → GitHub) or re-created via the dashboard's *Import from GitHub*. Lovable then asked for the API URL and the Supabase URL + publishable key (env not set yet; the preview shows empty data). Lovable's preview and published sites use different `*.lovable.app` subdomains, and the API's CORS was exact-match only → added `STOCK_API_CORS_ORIGIN_REGEX` (`allow_origin_regex`), default off, set to `https://.*\.lovable\.app` in `render.yaml`; test covers preview + published + localhost + a spoof host. pytest 70/70.

29. **Lovable, take two (2026-09-08).** The user created a fresh Lovable project **Blank Canvas Starter** (`e3a0dc1d-d931-425b-9c2e-cf064d043593`), connected GitHub (Lovable created **`MWPerrineJr/blank-canvas-starter`**), then merged the whole `stock-tool` history into it (`147b2cd`, plus a regenerated `package-lock.json`). Every synced commit showed "Build unsuccessful" because Lovable builds with `bun run build:dev` and the merge had kept our `package.json` (no `build:dev`). Fixes pushed to **both** repos: `build:dev` script (`33df879` / `1f02ca2`), the scaffold's stale `bun.lock` removed so Lovable regenerates it. Lovable has no env-var UI, so the root **`.env` is now committed** with the public hosted values (Render API URL, Supabase URL, publishable key); local overrides live in the gitignored `.env.local` (created from the old `.env`); `.env.example` removed; `supabase.ts` also accepts `VITE_SUPABASE_PUBLISHABLE_KEY` (`bd50a26`). That broke CI (MSW handlers hardcoded `localhost:8000` while the app now defaulted to Render; masked locally because this shell exports `VITE_*`) → vitest `test.env` pinned to the local API and handlers reuse `API_URL` from `@/lib/api` (`a58a942`). CI green on both repos (stock-tool run 34248026857, blank-canvas-starter run 34248029180). **Verified in Chrome on the Lovable preview** (`https://id-preview--e3a0dc1d-….lovable.app`, private, needs Lovable's token): search AAPL → dashboard quote, chart with EMAs/Bollinger/S-R, analyst data, all served by Render (`/quote`, `/indicators`, `/recommendations` 200) with CORS via the regex; no console errors. The old copy project "Stock UI Builder" can be deleted. Local repo has a `lovable` remote and a scratch worktree on branch `lovable-main` used to merge `main` into the Lovable repo.

30. **Canonical repo switch (2026-09-08).** The user chose the Lovable-linked repo as canonical and renamed it on GitHub to **`MWPerrineJr/PandagenticSignal`** (was `blank-canvas-starter`; GitHub redirects the old name). Locally: `origin` → PandagenticSignal, `main` fast-forwarded to its `main` (includes Lovable's scaffold commits and merges; no history rewritten), the `lovable` remote, scratch worktree and `lovable-main` branch removed. Pushes now go to `origin` only. Still to do by the user: re-point the Render service at PandagenticSignal (Render dashboard → service → Settings → Build & Deploy → Repository; Render currently deploys from `stock-tool`), then archive `stock-tool`.

31. **Render re-pointed (2026-09-08).** Changing the service's source repo by hand first turned it into a Node service (Render re-detected the repo root: built the frontend, then `yarn start` failed; the old Docker deploy kept serving with 40–90 s cold starts). The user then applied the blueprint from PandagenticSignal: Render created blueprint instance **PandagenticSignal** which re-adopted the same service (`srv-dafjbtn40ujc73bi5nm0`, URL unchanged: https://stock-tool-api-qg9s.onrender.com), runtime back to Docker, deploy live for `af53f4e` at 11:43. The prompt for `STOCK_API_CORS_ORIGINS` did not appear (newer Render UI creates `sync: false` vars blank); harmless, the regex covers Lovable. Verified: CORS header for the Lovable preview origin, a published-style `*.lovable.app` origin and localhost; none for an unknown origin. The old blueprint instance "Pandagentic Signal" (repo `stock-tool`) is now orphaned: delete it in Render **without** deleting its resources, or leave it.

32. **Custom domain + suspension (2026-09-08).** Lovable published the site at **https://pandagenticsignal.com** (www redirects to it; Lovable committed `bun.lock` and a plan note "Purchased custom domain"). The CORS regex only covers `*.lovable.app`, so `render.yaml` now sets `STOCK_API_CORS_ORIGINS` to the custom domain (+ `www`) and the local dev origins (`532e8b9`, rebased onto Lovable's commits). Meanwhile the API returned 503 with `x-render-routing: suspend-by-user`: the user suspended the only service at 12:24 thinking it was "the old one" (there was only ever one), then resumed it. Resume redeployed `af53f4e`, so the CORS push had not deployed; a follow-up push triggers the deploy + blueprint sync.

33. **Phase 7 closed (2026-09-08).** Pushes did not auto-deploy on Render after the resume, so "Deploy latest commit" was triggered by hand (94db5d6 live). The blueprint's env change also needed a **Manual sync** + Approve on the blueprint page (Render treats new env vars from `render.yaml` as an approval step). After that the API sends the CORS header for `https://pandagenticsignal.com`. **Final checkpoint:** `E2E_BASE_URL=https://pandagenticsignal.com npx playwright test` → 3/3 passed in 12.7 s against the published site + Render API + live Yahoo data. CI green on PandagenticSignal.

34. **Expansion planned (2026-09-08 evening).** The user asked for four new sections: Crypto, Retirement analysis, Portfolio builder with Monte Carlo, and an AI news-sentiment agent. Explored the codebase, probed yfinance (crypto quotes/history/screener/news all work), loaded the Claude API skill, and confirmed four decisions with the user (yfinance news, on-demand + 1 h cache with `claude-opus-5`, retirement = projection + MC success probability, crypto tab + crypto everywhere). Plan approved as Phases 8–11; full text below under "Expansion plan" and at `~/.claude/plans/now-i-want-to-mighty-possum.md`. Nothing implemented yet.

35. **Revert of an accidental edit (2026-09-11).** Commit `1af0797` "update files" (Sep 9, local) had deleted `day_high/day_low/year_high/year_low` from the API `Quote` schema and broke ruff format + two tests; CI was red and the commit never deployed to Render. The user did not remember making it, so it was reverted with a new commit (`4c8745c`, no history rewrite). CI green again.

36. **iCloud eviction was hanging every test run (2026-09-11).** `~/Documents` is iCloud Drive ("Desktop & Documents"), and ~10,600 files under `node_modules/` and `api/.venv/` had been evicted to placeholders (`ls -lO` shows `dataless`). Symptoms: `import app.main` took 40+ s (scipy), vitest failed every file with "Failed to start forks worker … Timeout waiting for worker to respond", CPU idle throughout. Fix: `find . -type f -flags +dataless -print0 | xargs -0 -P 16 cat > /dev/null` (about 11 min), after which everything ran at normal speed. **Recommendation for the user:** move the repo out of iCloud (e.g. `~/dev/stock-tool`) or turn off "Optimize Mac Storage"; otherwise this will recur. Check with `find . -type f -flags +dataless | wc -l`.

37. **Phase 8 (Crypto) built (2026-09-11).** API: `GET /crypto/top?limit=1..100` from `yf.screen("all_cryptocurrencies_us")` (cache ns `crypto_top`, TTL `crypto_ttl`=60 s), `SEARCH_TYPES` now includes `CRYPTOCURRENCY`, `Quote.quote_type` from `fast_info["quote_type"]`. Frontend: Crypto tab (top-25 table with 24h %, market cap, 24h volume, supply, 1M sparkline, star = track; coin detail = QuoteCard + 6M chart), `crypto` dashboard widget (top-N rows), "Crypto" badge in search results, quote card says "Crypto · USD", "Volume (24h)" and "24h range" for coins, `formatPrice` keeps 4–6 decimals under $1, `formatPct` added, shadcn `table` primitive installed. Verified live locally: `/crypto/top?limit=3` (BTC, ETH, USDT), `/search?q=bitcoin` (BTC-USD tagged CRYPTOCURRENCY), `/quote/BTC-USD` (`quote_type` set; note `fast_info` market cap is null for coins, the screener has it). Tests: API 76 passed (99% coverage), frontend 144 tests / 25 files, e2e spec gained a Crypto test.

38. **Crypto data moved to Coinbase + CoinGecko (2026-09-11, user's choice).** The user asked for Coinbase's free API; it has no market cap/supply, so the user picked "Coinbase + CoinGecko for ranking". New `api/app/services/crypto.py` (`CryptoData`): **Coinbase** Advanced Trade public market endpoints (no key, ~10 req/s) for prices, 24 h change/volume/range and OHLCV candles; **CoinGecko** `/coins/markets` (no key; optional `STOCK_API_COINGECKO_API_KEY` demo key raises its limit) for the market-cap ranking, market cap, circulating supply, names and icons. `MarketData.quote()`/`history()` route any `X-USD` symbol that is an online Coinbase USD spot product to Coinbase (so charts, indicators, sparklines and watchlist quotes for coins are Coinbase too); anything else, or Coinbase being unreachable, falls back to Yahoo as before. Design facts: one cached Coinbase `/products` list (1.2 MB, 402 USD pairs, TTL `crypto_ttl`=60 s) serves membership checks and every coin quote (no per-coin calls); candles are paged backwards in chunks of 300 (Coinbase rejects ≥350) with at most 12 requests (most recent window wins), weekly/monthly are resampled from daily; year high/low for a coin comes from its cached 1y daily candles; `CryptoData` has its own `Cache` so its lock never serialises yfinance calls; the HTTP fetcher is injectable (`tests/fakes.py::FakeFetch`), `make_fetcher` maps 404→`NotFound`, 429→503, other 4xx/5xx/network→502. `CryptoQuote` gained `rank`, `icon`, `high_24h`, `low_24h`, `price_source` ("coinbase" | "coingecko"; the table marks CoinGecko-priced coins with "· CG"). `httpx` is now an explicit dependency; scalar helpers moved to `services/convert.py`. Verified live locally: top 4 (BTC, ETH, USDT, BNB all priced by Coinbase), `/quote/BTC-USD` exchange "Coinbase" with 24 h + 52-week ranges and market cap, `/history/BTC-USD` 1mo/1d = 30 candles, 5y/1wk = 261, 1d/5m = 288, `/indicators/ETH-USD` 200, unknown coin 404, AAPL untouched. Tests: API 101 passed (new `test_crypto.py`), frontend updated for the new fields.

39. **Phase 9 (Portfolio builder + Monte Carlo) built (2026-09-11).** Engine `api/app/services/portfolio.py` (pure numpy/pandas): `align_closes` (inner join on calendar dates, ≥30 rows else `InsufficientDataError`), `log_returns`, `shrink_covariance` (toward the diagonal, on by default above 5 assets), `portfolio_stats` (annual return/vol, Sharpe rf 0, max drawdown, per-asset stats, correlation), `choose_step` (daily ≤2y, weekly ≤10y, monthly beyond), `simulate_portfolio` (Cholesky with eigen-clip fallback, rebalanced each step, cashflow per step, floored at 0), `simulate_parametric` (single-asset GBM for Phase 10; `mu_annual` compounds exactly as `(1+mu)^T` at zero vol), `downsample_indices`, `summarise_paths` (≤260 samples, p5/25/50/75/95 bands, terminal mean/median/percentiles, `prob_loss`, VaR/CVaR 95 against money put in). `MarketData.closes()` normalises Yahoo's exchange-local and Coinbase's UTC midnights to dates before joining. API: `POST /portfolio/analyse` and `POST /portfolio/simulate` (`api/app/routers/portfolio.py`; `Holding` = weight xor amount, one mode per request, 1..20 unique symbols, period 1y/2y/5y, horizon 1..40, sims 100..10000, optional seed), 422 for thin history (`InsufficientHistoryError`), CORS now allows POST, `RateLimiter` gained per-prefix overrides with separate windows (`/portfolio/simulate` → `STOCK_API_SIMULATE_RATE_LIMIT`, default 30/minute, added to `render.yaml`). Live: 40y × 10k sims × 5 assets = 0.9 s. Frontend: `src/lib/portfolio.ts` (model, `mode` weight|amount, storage rows = API rows), `postJson`, `usePortfolioStats`/`useSimulation` (simulation runs only on "Run"; a changed portfolio hides the stale fan), retry now also stops on 422/429, `src/stores/portfolios.ts` + `portfolio-repo.ts` + `use-portfolios.ts` (local/cloud, 1 s debounced save, seeds a new account from the local active portfolio), Portfolio tab (`src/features/portfolio/`: picker, holdings editor with weight/amount toggle + Normalise, KPI cards, SVG correlation heatmap, simulation controls, SVG fan chart with table view, terminal stats), `portfolio` dashboard widget. Supabase: `public.portfolios` (migration `20260911120000_portfolios.sql`, applied to stock-tool-dev via MCP; RLS owner policies; pgTAP `supabase/tests/0002_portfolios.test.sql`, not yet run). Advisors: only the pre-existing "leaked password protection disabled" auth warning. Tests: API 123 passed (99% coverage), frontend 166 tests / 31 files, e2e portfolio + crypto 2/2 locally (they fail if run concurrently with the build — CPU starvation, not a bug). Polish noted: uncontrolled number inputs (shadcn Button swallows `type=submit`, so Run reads the form via a ref).

40. **Phase 10 (Retirement) built (2026-09-11).** Engine `api/app/services/retirement.py`: `RetirementInputs` (validates `current_age < retirement_age < life_expectancy ≤ 110`, rates in ±50%, money ≥ 0), yearly `cashflows` (+12×contribution while `age < retirement_age`, then −spending×(1+inflation)^(t+1)), `project_deterministic` (nominal + real balances, floored at 0, optional return override), `simulate_retirement` (Phase 9's `simulate_parametric` at one step per year; success = money left at life expectancy; real-terms bands via `summarise_paths` with baseline = money put in; `median_depletion_age` over depleted paths), `arithmetic_from_log`. API `POST /retirement/project` (`routers/retirement.py`): inputs + `mode` parametric (expected_return + volatility, default 12%) or portfolio (moments from `portfolio_stats` of the holdings' history, converted to arithmetic growth and **clamped** to ±50% / ≤100% vol), `n_sims ≤ 10000`, seed; returns `assumptions{mu,sigma,source,symbols}`, `deterministic[YearPoint]`, `monte_carlo{success_probability, ages, bands, median_depletion_age, terminal, n_sims}`. `/retirement` shares the simulate rate-limit rule (own window). Frontend: `src/lib/retirement.ts` is a TS twin of the deterministic projection, pinned by `src/test/fixtures/retirement-parity.json` (3 cases generated from Python, compared to 4 decimals); `src/stores/retirement.ts` (localStorage only, inputs + assumptions source); Retirement tab (`src/features/retirement/`): range+number inputs for timeline/money/assumptions (native `<input type=range>` rather than the shadcn slider — jsdom-friendly, no extra dependency), "assumptions from" select listing saved portfolios (return/vol sliders lock, inflation stays), instant nest-egg SVG (nominal + today's-dollar lines, retirement marker, peak, table view), three summary tiles (nest egg at retirement, "runs out at N"/"lasts past N", balance at plan end), "Run Monte Carlo" → success card (probability with Comfortable/Borderline/At-risk verdict, typical depletion age, median terminal, assumptions) + the Phase 9 `FanChart` with new `xLabel`/`caption`/`baselineLabel` props showing ages. Changing any input hides the stale run. Default plan (35→65→90, $50k, $1k/mo, 6%, 2.5%, $50k spending) deliberately shows "runs out" — a teaching default, change if it reads as a bug. Tests: API 134 passed (99% coverage; `test_retirement.py` 8), frontend 173 tests / 33 files (`retirement.test.ts` parity + `retirement-page.test.tsx` 4), e2e retirement + portfolio 2/2 locally. No new env vars. Committed as `37cde46`, CI green.
41. **Phase 11 (AI news sentiment) built (2026-09-11).** `MarketData.news()` reduces `Ticker.news` (`content` shape: title, summary, pubDate, provider.displayName, canonicalUrl/clickThroughUrl) into `NewsItem`s, cached 15 min (`news_ttl`); empty is valid for a real symbol (validated via `quote`), a missing `news` attribute counts as empty. `api/app/services/sentiment.py`: `SentimentAgent(client, model, max_tokens, effort, cache, ttl, now)` with its **own** `Cache` (a slow model call never blocks the market-data lock; concurrent misses for one symbol collapse into one paid call), `analyse()` = one `client.messages.parse(... output_format=SentimentReport, output_config={"effort"}, system=[{text, cache_control}])` call, ≤12 articles, summaries cut at 600 chars; `stop_reason == "refusal"` / no `parsed_output` → `UpstreamError` (502), `anthropic.RateLimitError` → `RateLimitedError` (503 + Retry-After), other `APIStatusError`/`APIConnectionError` → 502; `clamp_report` enforces score ±1, confidence 0..1, ≤5 themes, one entry per article index. `report()` caches the assembled `SentimentOut` for `sentiment_ttl` (1 h) and flags `cached`; failures are not cached. `make_agent(settings)` builds a real `anthropic.Anthropic(timeout=90, max_retries=1)` only when a key is set. Settings: `anthropic_api_key` accepts **either** `STOCK_API_ANTHROPIC_API_KEY` or plain `ANTHROPIC_API_KEY` (`AliasChoices`), `sentiment_model=claude-opus-5`, `sentiment_effort=medium`, `sentiment_max_tokens=8192`, `sentiment_ttl=3600`, `news_ttl=900`, `sentiment_rate_limit=10/minute` (own window, `/sentiment` prefix). Routes: `GET /sentiment/status` → `{enabled, model}`; `GET /sentiment/{ticker}` → 503 `Sentiment analysis is not configured` without a key, else `{symbol, generated_at, model, cached, news_count, report|null, articles[{index,title,provider,published_at,url,sentiment,rationale}], disclaimer}`. `render.yaml`: `ANTHROPIC_API_KEY` with `sync: false` + `STOCK_API_SENTIMENT_RATE_LIMIT`. SDK `anthropic>=1.5` (brings `httpx2`; dev `httpx` for TestClient coexists). Frontend: `api.ts` schemas + `ApiError.isUnavailable/isRateLimited`, retry also stops on 503; `useSentimentStatus()` (staleTime ∞), `useSentiment(symbol, enabled)` (retry false, staleTime/gcTime 1 h, so a report paid for on the Sentiment tab shows in the widget/Crypto tab without a second call); `src/features/sentiment/sentiment-panel.tsx` (idle button → loading copy "10–30 s" → result: overall badge, diverging `ScoreBar`, confidence, theme chips, summary, article list with badge/rationale/link, footer with disclaimer · count · time · "cached"; 429 → "Too many analyses" + Try again; `showDisabledNote` on the page, silent elsewhere; `compact` for the widget), `sentiment-page.tsx` (route `/sentiment`, nav "Sentiment"), `sentiment` widget (`{symbol}`, 4×6), panel mounted under the Crypto tab's coin detail. Tests: API 161 passed / 99% (`test_sentiment.py` 24 incl. routes, `test_hardening.py` own window), frontend 185 / 36 files (panel 6, page 3, widget 3), e2e "sentiment tab" (reads `/sentiment/status` via `page.request`; asserts the disabled note without a key, a result within 90 s with one) — 1/1 locally in the disabled branch. MSW gotcha: an override for `/sentiment/:symbol` also swallows `/sentiment/status` (`server.use` prepends), so overrides use literal symbols. Model choice: `claude-opus-5` per the claude-api skill default; effort `medium`; no server-side refusal fallbacks yet (financial-news tone is not a refusal category in practice — revisit if a 502 "declined" ever shows up in logs). Committed as `68bc88e`, CI green.
42. **Phase 11 live + CoinGecko throttling on Render (2026-09-11).** Deployed by the user (key pasted as `ANTHROPIC_API_KEY`, blueprint synced, Manual Deploy, Lovable published). Live check: `/sentiment/status` → `{enabled: true, model: claude-opus-5}`; `GET /sentiment/AAPL` took 14.6 s, 10 headlines, verdict neutral (score 0.05, confidence 0.45) with off-topic items correctly flagged, second call `cached: true`, `x-ratelimit-limit: 10`. Production Playwright: 6/7 — the **crypto tab** test fails with "api.coingecko.com rate limit reached" because CoinGecko's keyless tier is throttled per source IP and Render's free-plan outbound IP is shared with strangers; the ranking fetch (`/coins/markets`) fails often even though the same URL answers 200 from a home connection. Fix committed as `8bb6411`: `CryptoData._markets()` keeps the last good page (`_stale_markets`, up to `STALE_MARKETS_MAX_AGE` = 24 h) and serves it when CoinGecko returns 429/5xx (Coinbase prices stay live, warning logged); and `retryUnlessNotFound` retries 503 again (Phase 11 had stopped that for the "no key" case — sentiment now opts out via `retry: false` on its own hook, everything else keeps the two retries). **Real fix is a free CoinGecko Demo key** (`STOCK_API_COINGECKO_API_KEY`, already supported; per-key quota instead of per-IP) — ask the user to create one at coingecko.com → API → Demo and paste it on Render. `8bb6411` still needs a Render Manual Deploy (auto-deploy did not fire again). Follow-up commit: `coingecko_ttl` = 5 min for the ranking page (was `crypto_ttl` 60 s; Coinbase prices stay at 60 s) and `STOCK_API_COINGECKO_API_KEY` declared `sync: false` in `render.yaml` (paste the value on the dashboard; blueprint Manual sync + Approve).

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
| `436b5c9` | Phase 6 closed: customizable dashboard |
| `6f244fe` | User: Phase 7 work in progress ("updated files") |
| `0b77b56` | Phase 7 part 1: hardening, Docker, Playwright, README |

Toolchain: Node 24.18, Vite 8, React 19, TypeScript 6, Tailwind 4, shadcn (Base UI), vitest 5, MSW 2; Python 3.12 via uv, FastAPI, yfinance 1.7.0, httpx 0.28, pandas 3.0.5. Data: Yahoo (stocks/ETFs/search), Coinbase + CoinGecko (crypto). GitHub CLI authenticated; no remote configured yet.

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
- [x] API rate limiting (`limits`), JSON logging, CORS from env, Dockerfile, `render.yaml`
- [x] Docker image verified by Render's build (local Docker not needed)
- [x] Optional Supabase edge-function proxy — skipped deliberately (see note 25)
- [x] Playwright E2E smoke (3 tests, live data) + weekly/dispatch CI job
- [x] GitHub push (repo created by the user, public), CI green
- [x] Render deploy from the blueprint; CORS = custom domain + `*.lovable.app` regex + local dev
- [x] Lovable import + env: GitHub-linked project (note 29), preview verified live. Supabase integration in Lovable not connected (not required: the app talks to Supabase directly)
- [x] README with architecture, run, test and deploy instructions
- [x] Final test checkpoint: CI green on PandagenticSignal, Playwright 3/3 against https://pandagenticsignal.com

### Phase 8 — Crypto
- [x] API: `/crypto/top`, crypto in search, `Quote.quote_type`, `crypto_ttl`; fakes + 6 new tests
- [x] Data source switched to Coinbase (prices, candles) + CoinGecko (ranking, market cap, supply, icons) — note 38; Yahoo only as fallback for coins Coinbase does not trade
- [x] Frontend: Crypto tab (`src/features/crypto/`), `crypto` widget, search badge, quote-card labels, `formatPrice`/`formatPct`
- [x] Tests: `crypto-page.test.tsx` (6), `crypto-widget.test.tsx` (3), `format.test.ts`, api client tests; e2e "crypto tab" test
- [x] Checkpoint part 1: committed + pushed as `f142edf`, CI green, crypto e2e test 1/1 locally against the dev servers; Coinbase/CoinGecko switch committed after that (see git log)
- [x] Checkpoint part 2: user ran Render Manual Deploy + Lovable Publish (2026-09-11); `/crypto/top` live on Render, Playwright 6/6 against pandagenticsignal.com

### Phase 9 — Portfolio builder + Monte Carlo
- [x] Engine `services/portfolio.py` + 16 unit tests; `MarketData.closes()`
- [x] API: `POST /portfolio/analyse|simulate`, POST CORS, per-prefix rate limit, 422 error; router/hardening/market_data tests
- [x] Frontend: model, client, queries, store/repo/hook (local + cloud), Portfolio tab, widget; 35 new tests
- [x] Supabase `portfolios` table applied to stock-tool-dev (MCP) + migration file + pgTAP file
- [x] e2e "portfolio tab" test, 2/2 locally with the crypto test
- [x] Deployed 2026-09-11: `POST /portfolio/analyse` returns 200 with `access-control-allow-origin: https://pandagenticsignal.com`; `/portfolio/simulate` shows `x-ratelimit-limit: 30` (blueprint sync worked); Playwright 6/6 against pandagenticsignal.com

### Phase 10 — Retirement
- [x] Engine `services/retirement.py` + 8 unit tests; `arithmetic_from_log`
- [x] API `POST /retirement/project` (parametric | portfolio), limiter override, validation; router + hardening tests
- [x] Frontend: TS twin + parity fixture, store, Retirement tab (form, nest-egg chart, success card, fan chart by age), nav; 7 new tests
- [x] e2e "retirement tab" test, 2/2 locally with the portfolio test
- [x] Checkpoint: committed + pushed as `37cde46`, CI green (Phase 9 was `61d38a5`, Coinbase switch `e8117e1`, Phase 8 `f142edf`)
- [x] Deployed 2026-09-11: `POST /retirement/project` live on Render; retirement e2e passes against pandagenticsignal.com. **Phase 10 closed.**

### Phase 11 — AI news-sentiment agent
- [x] API: `MarketData.news()`, `services/sentiment.py`, `GET /sentiment/status|{ticker}`, 503 when unconfigured, limiter override, `anthropic` SDK; fakes (`FakeTicker.news`, `tests/fake_anthropic.py`), 24 unit tests + hardening window test, `tests/integration/test_sentiment_live.py` (skips without a key)
- [x] Frontend: schemas/hooks, `SentimentPanel` (+ `ScoreBar`, `SentimentBadge`), Sentiment tab + nav, `sentiment` widget, panel under coin detail; 12 new tests; e2e "sentiment tab"
- [x] Config/docs: `render.yaml` (`ANTHROPIC_API_KEY` sync:false, `STOCK_API_SENTIMENT_RATE_LIMIT`), README env + data-source notes
- [x] Checkpoint: committed + pushed as `68bc88e`, CI green
- [x] Deployed 2026-09-11: `/sentiment/status` enabled with `claude-opus-5`; live AAPL report in 15 s, second call cached; limiter 10/minute. **Phase 11 closed.**
- [ ] Production Playwright 6/7: crypto tab blocked by CoinGecko per-IP throttling on Render (note 42). Needs: Render Manual Deploy of `8bb6411` (stale-ranking fallback) and ideally a CoinGecko Demo key in `STOCK_API_COINGECKO_API_KEY`; then rerun → 7/7

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

## Pick up here

**Where things stand (2026-09-11):** Phases 0–7 closed and live. Phases 8 (Crypto, notes 37–38),
9 (Portfolio + Monte Carlo, note 39) and 10 (Retirement, note 40) are built, tested, committed and pushed
to `main` with CI green on every commit (latest `37cde46`) and **deployed 2026-09-11** (Render + Lovable);
Playwright 6/6 against https://pandagenticsignal.com. Phases 8–10 closed.
**Phase 11 (AI news sentiment, note 41) is live (note 42); the expansion plan (Phases 8–11) is complete.** What remains is the polish backlog below
(dialogs instead of `window.prompt`, pgTAP via `supabase test db --linked`, bundle splitting, …) and
optionally server-side refusal fallbacks for the sentiment call. Pull first (`git pull`).
**Before anything else on this Mac:** `find . -type f -flags +dataless | wc -l` must be 0 (note 36).
**Pending from the user:** Render Manual Deploy of `8bb6411` (CoinGecko stale fallback) and a free CoinGecko Demo key pasted as `STOCK_API_COINGECKO_API_KEY` on Render (note 42); then production Playwright should be 7/7.

**Live pieces:**
- Site: https://pandagenticsignal.com (Lovable-published, custom domain; www redirects). Lovable project
  "Blank Canvas Starter" `e3a0dc1d-d931-425b-9c2e-cf064d043593`, private preview at
  `https://id-preview--e3a0dc1d-….lovable.app`.
- Repo (canonical): https://github.com/MWPerrineJr/PandagenticSignal — Lovable syncs both ways with it;
  never rewrite pushed history. `stock-tool` is the old repo (archive it).
- API: https://stock-tool-api-qg9s.onrender.com (Render free plan, Docker, blueprint "PandagenticSignal";
  cold start 30–90 s). Env from `render.yaml`; a **new** env key in `render.yaml` needs Manual sync +
  Approve on the blueprint page. Auto-deploy on push has been flaky since the repo switch — if a push
  does not deploy, use Manual Deploy → Deploy latest commit.
- Supabase: `stock-tool-dev` (`agumrmsaeblcldcygajl`).
- Frontend config is the committed root `.env`; local overrides in `.env.local` (this shell also exports
  `VITE_*`, which override both — unset them when reproducing CI).

**To resume locally:** `cd api && uv run uvicorn app.main:app --reload` and `npm run dev`. Pull first:
Lovable commits to `main`.

**Open items (user):** archive `stock-tool` on GitHub; optionally delete the orphaned Render blueprint
"Pandagentic Signal" (keep resources); if magic-link sign-in is used from the site, add
`https://pandagenticsignal.com` to Supabase Auth → URL configuration.

**Polish backlog, rough priority:** replace `window.prompt`/`confirm` in the dashboard toolbar with
dialogs; Bollinger band fill (custom primitive); scale S/R `order` with bar count; consider Yahoo's
`recommendationKey` for the consensus label; `supabase link` + `supabase test db --linked` for the
pgTAP tests; split the main bundle further; retry in `MarketData._history` on transient empty frames.

## Next actions (Phase 7 detail)

1. **User steps to finish Phase 7:** (a)–(c) done; (d) import into Lovable with `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, then send the Lovable origin so `STOCK_API_CORS_ORIGINS` can be set. After (c)/(d): `E2E_BASE_URL=<lovable url> npx playwright test`.
2. Then close Phase 7 in this log with the final checkpoint.
3. Previous plan for reference — **Phase 7** — Hardening, deployment, Lovable import. Order: (a) API `Dockerfile` + `slowapi` rate limiting + CORS from env + `/health` used by the host; deploy to Render or Railway (user picks; needs an account and will ask for env vars `STOCK_API_CORS_ORIGINS`); (b) Playwright E2E smoke (search → chart → watchlist → analysts) against the dev servers, plus a CI job; (c) `gh repo create` + push (CI runs), then Lovable import via GitHub with `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; (d) README architecture + run + deploy sections; (e) optional Supabase edge-function proxy if the API host needs hiding; (f) final checkpoint. Optional polish first: replace `window.prompt`/`confirm` in the dashboard toolbar with dialogs. Optional: `supabase link --project-ref agumrmsaeblcldcygajl` then `supabase test db --linked` for the pgTAP RLS tests.
2. Optional: move `api/app/stock-tool.code-workspace` to the repo root (adjust `path` to `.`).
3. Optional: `pip install pre-commit && pre-commit install`; `gh repo create` and push so CI runs (otherwise Phase 7).

## Expansion plan (Phases 8–11, approved 2026-09-08)

### Context

Phases 0–7 are closed and live at https://pandagenticsignal.com (repo `MWPerrineJr/PandagenticSignal`,
Lovable-linked; FastAPI + yfinance API on Render at https://stock-tool-api-qg9s.onrender.com; Supabase
`stock-tool-dev`). The user wants four new sections:

1. **Crypto** — dedicated tab plus crypto symbols working everywhere.
2. **Portfolio builder + Monte Carlo** — mixed stock/crypto holdings, simulated wealth paths, risk stats; persisted like watchlists.
3. **Retirement analysis** — deterministic projection plus Monte Carlo "probability your money lasts", sharing the engine.
4. **AI news-sentiment agent** — on-demand Claude analysis of Yahoo Finance news for a stock or coin.

Decisions confirmed 2026-09-08: news from yfinance `Ticker.news` (not web search); on-demand + 1 h server
cache with `claude-opus-5` (~3–5 ¢ per analysis, key on Render); retirement = projection + MC success
probability; crypto tab + crypto everywhere.

Verified against yfinance 1.7 today: `fast_info` works for `BTC-USD` (quoteType `CRYPTOCURRENCY`,
marketCap); `Search("bitcoin")` returns CRYPTOCURRENCY rows (currently dropped by `SEARCH_TYPES`);
`Ticker.news` gives 10 items with `content.{title,summary,pubDate,provider.displayName,canonicalUrl.url}`;
`yf.screen("all_cryptocurrencies_us", count=N)` returns top coins by market cap with
price/change%/marketCap/volume/circulatingSupply; mixed stock+crypto closes have NaN on weekends for
stocks (inner-join on common days).

Two code facts that shape the design: `api/app/main.py` CORS has `allow_methods=["GET"]` (POST endpoints
need `["GET","POST"]`), and `api/app/services/cache.py` runs the miss factory under one global `RLock`
(a 10–30 s Claude call must use its own `Cache()` instance).

### Order

| Phase | Section | Why |
|---|---|---|
| 8 | Crypto | Smallest; unlocks crypto symbols in search/fakes/fixtures that Phase 9 needs; adds the shadcn `table` primitive. |
| 9 | Portfolio + Monte Carlo | Engine first, then endpoints/UI. Introduces POST + CORS change, per-prefix rate limiting (reused by 10 and 11), SVG fan chart (reused by 10). |
| 10 | Retirement | Depends on Phase 9's parametric simulator and fan chart. |
| 11 | AI sentiment | Independent of 8–10 (disjoint files). Last only because it needs a paid secret + Render blueprint sync. Can be swapped to run right after 8 (then build the per-prefix limiter inside 11). |

Every phase ends with the checkpoint: `cd api && uv run ruff check . && uv run ruff format --check . && uv run pytest --cov`
→ `npm run lint && npm run typecheck && npm test && npm run build` → session.md entry → commit + push `main`
→ Render check (`/health` + the new endpoint; Manual Deploy → "Deploy latest commit" if auto-deploy stalls;
new env keys need blueprint Manual sync + Approve) → `E2E_BASE_URL=https://pandagenticsignal.com npx playwright test`.
Pull before starting (Lovable commits to `main`); never rewrite pushed history.

---

### Phase 8 — Crypto

**Goal:** "Crypto" tab with a top-coins table (price, 24h %, market cap, volume, 1M sparkline) and a coin
detail panel; `BTC-USD`-style symbols work in search, watchlist, charts, dashboard.

### API
- `GET /crypto/top?limit=25` (1..100) → `{ as_of: epoch_s, coins: [{symbol, name, price, change_pct, market_cap, volume, circulating_supply}] }`.
- `api/app/services/market_data.py`: `SEARCH_TYPES = {"EQUITY","ETF","CRYPTOCURRENCY"}`; `top_crypto(limit=25) -> list[CryptoQuote]` via `self._call(self.yf.screen, "all_cryptocurrencies_us", count=limit)`, cache ns `"crypto_top"`, TTL `settings.crypto_ttl` (60); map with existing `_num/_int/_str`. Add `quote_type: str | None` to `Quote` from `fast_info["quote_type"]` so the quote card can label "Crypto" / "24h".
- `api/app/schemas.py`: `CryptoQuote`, `CryptoTop`. `api/app/routers/crypto.py` (`APIRouter(tags=["crypto"])`, `limit: Query(ge=1, le=100)`), registered in the `create_app` tuple. `settings.crypto_ttl`.
- Sparklines reuse `/history/{symbol}?period=1mo&interval=1d`.

### Frontend
- `src/lib/api.ts`: `cryptoQuoteSchema`, `cryptoTopSchema`, `api.cryptoTop`. `src/lib/format.ts`: `formatPrice` shows 4–6 decimals under $1.
- `src/lib/queries.ts`: `queryKeys.cryptoTop(limit)`, `useCryptoTop(limit)` (staleTime + refetchInterval MINUTE).
- `src/app/routes.tsx`: lazy `CryptoPage`; `NAV_ITEMS += { to: '/crypto', label: 'Crypto' }` in `src/components/layout/app-shell.tsx`.
- `src/features/crypto/crypto-page.tsx` (h1, Skeleton → alert → table ladder), `market-table.tsx` (rows `data-testid="row-BTC-USD"`, click sets `?t=` via `useTicker`, track toggle via `useWatchlist`, `Sparkline` from `features/watchlist/sparkline.tsx`), `coin-detail.tsx` (QuoteCard + lazy `PriceChart` via `useIndicators` + a `SentimentSlot` placeholder filled in Phase 11). Install `npx shadcn@latest add table` (Base UI components import `cn` from the `cn` package).
- Widget `crypto` (top-N compact rows): `WIDGET_TYPES += 'crypto'`, config `{ limit: int 1..20 default 5 }`, size `{w:4,h:8,minW:3,minH:5}`, title "Crypto market", `widgets/crypto-widget.tsx` + registry entry.
- Search combobox: "Crypto" type badge for `CRYPTOCURRENCY` results.

### Tests
- Python: `tests/fakes.py` → `FakeYF.screen(query, count)` fixture (BTC-USD, ETH-USD), `FAST_INFO["BTC-USD"]`, a CRYPTOCURRENCY row in `SEARCH_QUOTES`; `test_market_data.py` (top_crypto maps/caches/limits, search includes crypto, quote BTC-USD); `test_routers.py` (`/crypto/top` shape, `limit=0`/`500` → 422, upstream → 502).
- Frontend: `fixtures.ts` `cryptoTopFixture` + `quoteFixtures['BTC-USD']`; `handlers.ts` `GET /crypto/top`; `crypto-page.test.tsx`, `crypto-widget.test.tsx`; registry/layout/use-watchlist tests updated.
- e2e: Crypto tab → `row-BTC-USD` with `$` price → click → `price-chart` visible → search "bitcoin" picks `BTC-USD`.

### Deploy
- No env changes. Verify `curl .../crypto/top?limit=3` and `/search?q=bitcoin` on Render.

---

### Phase 9 — Portfolio builder + Monte Carlo

**Goal:** Holdings (stocks + crypto), summary stats, correlated Monte Carlo fan chart; portfolios persist
local (signed out) / Supabase (signed in).

### Engine — `api/app/services/portfolio.py` (pure numpy/pandas)
- `align_closes(frames: dict[str, pd.Series]) -> pd.DataFrame` (inner join, dropna; `ValueError` if < 30 rows).
- `log_returns(closes) -> pd.DataFrame`; `shrink_covariance(cov, n_obs, *, shrinkage=None)` (Ledoit-Wolf-style toward the diagonal, default on when > 5 assets).
- `portfolio_stats(returns, weights, *, periods_per_year=252) -> PortfolioStats` — annual return/vol, Sharpe (rf 0), max drawdown, per-asset return/vol, correlation matrix.
- `choose_step(horizon_years) -> (steps_per_year, n_steps)` — daily ≤ 2y, weekly ≤ 10y, monthly beyond (keeps `n_steps ≤ ~520`; 40y daily × 10k sims × 20 assets is infeasible on the free Render instance); scale `mu`/`cov` by `252/steps_per_year`.
- `simulate_portfolio(mu, cov, weights, *, initial, n_steps, n_sims, cashflow_per_step=0.0, seed=None) -> np.ndarray (n_sims, n_steps+1)` — Cholesky (eigh-clip fallback), per-step vectorised draws, rebalanced `value *= w · exp(r)`.
- `simulate_parametric(mu_annual, sigma_annual, *, initial, cashflows, steps_per_year, n_sims, seed=None, floor_at_zero=True)` — single-asset GBM with per-step cashflows (Phase 10 reuses).
- `downsample_indices(n_steps, max_points=260)`; `summarise_paths(paths, *, initial, steps_per_year, max_points=260, percentiles=(5,25,50,75,95)) -> PathSummary` — `times`, `bands`, terminal `{mean, median, p5, p25, p75, p95, prob_loss, var_95, var_95_pct, cvar_95}`.
- `MarketData.closes(symbols, period) -> pd.DataFrame` reusing `self.history(sym, period, "1d")` + `align_closes` (history cache + existing 404s; `yf.download` batching noted as a later optimisation).

### API
- CORS `allow_methods=["GET","POST"]`.
- Rate limiting, `api/app/ratelimit.py`: `RateLimiter(rule, *, overrides: dict[str,str] | None = None, enabled=True)`; single strategy; `_rules` = overrides by longest prefix first + `("", default)`; `_match(path)`; `hit(scope, ip)` keys storage `f"{scope}:{ip}"`; middleware unchanged otherwise (headers reflect the matched rule). `main.py`: overrides `{"/portfolio/simulate": settings.simulate_rate_limit, "/retirement": settings.simulate_rate_limit, "/sentiment": settings.sentiment_rate_limit}`. `settings.simulate_rate_limit = "30/minute"`.
- `POST /portfolio/analyse` body `{ holdings: [{symbol, weight} | {symbol, amount}] (1..20, one mode), period: "1y"|"2y"|"5y" }` → `{ symbols, weights, period, start, end, n_obs, annual_return, annual_vol, sharpe, max_drawdown, assets:[{symbol, weight, annual_return, annual_vol}], correlation: number[][] }`.
- `POST /portfolio/simulate` body = analyse + `{ horizon_years 1..40, n_sims 100..10000 (2000), initial_value (10000), monthly_contribution (0), seed? }` → `{ initial_value, horizon_years, steps_per_year, n_sims, times, bands:{p5,p25,p50,p75,p95}, terminal, stats }`.
- `api/app/routers/portfolio.py`; schemas `Holding`, `PortfolioRequest`, `SimulateRequest`, `PortfolioStatsOut`, `SimulationOut` with validators. Unknown symbol → 404; too few aligned rows → 422.

### Frontend
- `src/lib/portfolio.ts` (pure): `MAX_HOLDINGS = 20`, `holdingSchema`, `portfolioSchema {id, name, holdings, updatedAt}`, `normaliseHoldings`, `weightsFromAmounts`, `holdingsKey`, `starterPortfolio()`.
- `src/lib/api.ts`: `postJson(path, schema, body, init)`; `portfolioStatsSchema`, `simulationSchema`; `api.portfolioAnalyse`, `api.portfolioSimulate`. `queries.ts`: `usePortfolioStats(holdings, period)`, `useSimulation(params, {enabled})` (runs only after "Run simulation"); `retryUnlessNotFound` also stops on 422/429.
- Persistence mirroring `use-dashboard`: `src/stores/portfolios.ts` (`persist` `stock-tool.portfolios`, `{portfolios, activeId}`), `src/lib/portfolio-repo.ts` (`listPortfolios`, `savePortfolio` upsert on id, `deletePortfolio`), `src/lib/use-portfolios.ts` (local vs cloud, `SAVE_DEBOUNCE_MS` + `flush`, one-time import flag `stock-tool.portfolios.imported:${userId}`).
- Page `src/features/portfolio/portfolio-page.tsx` (route `/portfolio`, nav "Portfolio"): `portfolio-picker.tsx` (select + new/rename/delete like the dashboard toolbar), `holdings-editor.tsx` (shadcn table, `TickerSearch` to add, weight/amount toggle, Normalise), `stats-cards.tsx` (KPI cards), `correlation-matrix.tsx` (SVG heatmap, diverging palette, `role="figure"`, table toggle), `simulation-controls.tsx`, `fan-chart.tsx` (SVG percentile polygons + median, table toggle; SVG because lightweight-charts has no band fill and SVG is jsdom-testable), `terminal-stats.tsx`.
- Widget `portfolio`: config `{ portfolioId: string | null }` (null = active); name, top holdings, return/vol; size `{w:4,h:8}`.

### Supabase — `supabase/migrations/20260909120000_portfolios.sql`
- `public.portfolios (id uuid pk, user_id uuid fk cascade, name text check 1..60, holdings jsonb array ≤ 20 items, created_at, updated_at, unique(user_id,name))`; index `user_id`; `set_updated_at` trigger; RLS + four owner policies `user_id = (select auth.uid())`. No RPC (upsert on id like `dashboard_layouts`). Apply via the Supabase MCP connector to `agumrmsaeblcldcygajl`, commit the file, add `supabase/tests/0002_portfolios.test.sql` (pgTAP). Retirement inputs stay in localStorage (no table).

### Tests
- Python `tests/unit/test_portfolio.py`: alignment drops non-overlapping rows; closed-form stats on a constant-return series; simulated correlation ≈ input (seeded); seed determinism; downsample ≤ 260; bands monotonic; `prob_loss ∈ [0,1]`; parametric `sigma=0` compounds exactly; cashflow floor. `test_routers.py`: 0/21 holdings, mixed modes, `n_sims=20000` → 422; unknown symbol → 404; seeded response stable. `test_hardening.py`: `/portfolio/simulate` override trips independently of `/quote`. `test_market_data.py`: `closes()` mixed set.
- Frontend: `portfolio.test.ts`, `portfolio-repo.test.ts`, `use-portfolios.test.tsx` (local + cloud + import-once), `fan-chart.test.tsx`, `portfolio-page.test.tsx`, `portfolio-widget.test.tsx`; MSW `POST /portfolio/analyse|simulate` + fixtures; `supabase-mock.ts` gains `portfolios` table + `seedPortfolio()`.
- e2e: Portfolio tab → add AAPL + BTC-USD → KPI text → Run → "simulated wealth" figure → reload keeps holdings.

### Deploy
- `render.yaml`: `STOCK_API_SIMULATE_RATE_LIMIT=30/minute` (new key → Manual sync + Approve). Verify a POST from the site passes CORS and returns bands.

---

### Phase 10 — Retirement

**Goal:** Inputs → deterministic nest-egg chart + Monte Carlo success probability; assumptions parametric
or derived from a saved portfolio.

### Engine — `api/app/services/retirement.py`
- `RetirementInputs(current_age, retirement_age, life_expectancy, current_savings, monthly_contribution, expected_return, inflation, annual_spending)` (spending in today's dollars, inflation-adjusted withdrawals).
- `cashflows(inputs) -> np.ndarray` (yearly: +12×contribution before retirement, −spending×(1+inflation)^t after).
- `project_deterministic(inputs) -> list[YearPoint{age, year, balance_nominal, balance_real, cashflow}]` (floor 0).
- `simulate_retirement(inputs, *, mu, sigma, n_sims, seed) -> RetirementSim` via `portfolio.simulate_parametric(steps_per_year=1)`: `success_probability`, real-terms bands per age, `median_depletion_age | None`, terminal via `summarise_paths`.

### API
- `POST /retirement/project` body = inputs + `{ mode: "parametric"|"portfolio", volatility? (0.12), holdings?, period? ("2y"), n_sims (2000, ≤10000), seed? }` → `{ assumptions:{mu, sigma, source}, deterministic:[YearPoint], monte_carlo:{ success_probability, ages, bands, median_depletion_age, terminal } }`. Validation `current_age < retirement_age < life_expectancy ≤ 110`, rates in [−0.5, 0.5]. Portfolio mode derives mu/sigma from `portfolio_stats(MarketData.closes(...))`. Covered by the `/retirement` limiter override.
- `api/app/routers/retirement.py`; schemas `RetirementRequest`, `YearPoint`, `RetirementOut`.

### Frontend
- `src/lib/retirement.ts`: TS twin of the deterministic projection for instant slider feedback, pinned to Python by a committed parity fixture `src/test/fixtures/retirement-parity.json` (generated from the Python function); `retirementInputsSchema` with defaults.
- `src/stores/retirement.ts` (`persist` `stock-tool.retirement`) — localStorage only.
- `src/features/retirement/retirement-page.tsx` (route `/retirement`, nav "Retirement"): `retirement-form.tsx` (install `npx shadcn@latest add slider`; sliders + number inputs; assumptions source select incl. "Use portfolio…" from `usePortfolios`), `nest-egg-chart.tsx` (SVG nominal + real lines, retirement-age marker, table toggle), `success-card.tsx`, reuse `features/portfolio/fan-chart.tsx` with `xLabels = ages`, "Run Monte Carlo" → `useRetirementProjection(params, {enabled})`. Disclaimer: illustrative only.
- `api.ts` `retirementOutSchema`, `api.retirementProject`; `queries.ts` `useRetirementProjection`.

### Tests
- Python `tests/unit/test_retirement.py`: zero return/inflation arithmetic; contributions stop at retirement; withdrawals inflate; floor; `sigma=0` sufficient → 1.0, insufficient → 0.0; seed determinism; misordered ages → 422; portfolio mode with fakes returns `source="portfolio"`.
- Frontend: `retirement.test.ts` (parity), `retirement-page.test.tsx`, MSW `POST /retirement/project`.
- e2e: Retirement tab → change retirement age → nest-egg figure → Run → `%` probability text.

### Deploy
- No new env. Verify POST on Render; p50 band ≈ deterministic path when `sigma≈0`.

---

### Phase 11 — AI news-sentiment agent

**Goal:** On-demand, 1 h-cached Claude analysis of Yahoo news for a symbol; never advice; disabled
cleanly without a key.

### Dependencies / config
- `api/pyproject.toml`: `anthropic>=1.0` → `uv lock` (SDK 1.x uses `httpx2`; dev `httpx` for TestClient coexists — confirm at lock time).
- `settings.py`: `anthropic_api_key: str = ""`, `sentiment_model = "claude-opus-5"`, `sentiment_max_tokens = 4096`, `sentiment_ttl = 3600`, `news_ttl = 900`, `sentiment_rate_limit = "10/minute"`.
- `render.yaml`: `STOCK_API_ANTHROPIC_API_KEY` with `sync: false` (value set in the Render dashboard after Manual sync + Approve); `STOCK_API_SENTIMENT_RATE_LIMIT=10/minute`.

### Services
- `MarketData.news(ticker) -> list[NewsItem{title, summary, published_at, provider, url}]` from `Ticker.news` `item["content"]`; cache ns `"news"`, TTL `news_ttl`; empty list valid (validate the symbol via `quote()` only when empty, like recommendations).
- `api/app/services/sentiment.py`:
  - `SentimentReport(BaseModel)`: `overall: Literal["bullish","neutral","bearish"]`, `score: float` (−1..1), `confidence: float` (0..1), `themes: list[str]`, `articles: list[ArticleSentiment{index, sentiment, rationale}]`, `summary: str`. Bounds stated in the prompt and clamped after parse (keep the `output_format` model plain).
  - `SYSTEM_PROMPT` constant (role; no investment advice or price predictions; neutral when evidence is thin; 3–5 themes; one-sentence rationales) sent as `system=[{"type":"text","text":SYSTEM_PROMPT,"cache_control":{"type":"ephemeral"}}]`; all volatile content (symbol, articles) in the user message.
  - `build_user_message(symbol, news) -> str` (numbered articles, summaries ≤ ~600 chars).
  - `SentimentAgent(client: anthropic.Anthropic | None, *, model, max_tokens, cache: Cache, ttl)`; `enabled`; `analyse(symbol, news) -> SentimentReport` via `client.messages.parse(model=..., max_tokens=..., system=[...], messages=[...], output_format=SentimentReport)`; `stop_reason == "refusal"` or `parsed_output is None` → `UpstreamError`; `anthropic.RateLimitError` → `RateLimitedError` (503); `APIStatusError`/`APIConnectionError` → `UpstreamError` (502). Client `timeout=60.0, max_retries=1`. Optional later: server-side refusal fallbacks (`fallbacks="default"`, beta header) once the happy path is verified.
  - `report(symbol, news)` cached in the agent's **own `Cache()`** instance (`"sentiment"`, `sentiment_ttl`) so a slow model call never blocks other endpoints and concurrent requests for one symbol de-duplicate spend.
- `api/app/deps.py`: `get_sentiment_agent()` (`lru_cache`; client `None` when the key is empty), `SentimentAgentDep`.
- Cache decision: server memory only; no `sentiment_reports` table (ephemeral, non-user-specific, no UX gain).

### API
- `GET /sentiment/status` → `{ enabled, model }`.
- `GET /sentiment/{ticker}` → 503 `Sentiment analysis is not configured` when disabled; else `{ symbol, generated_at, model, cached, news_count, report | null (no news), articles:[{index, title, provider, published_at, url, sentiment, rationale}], disclaimer }`. GET keeps it cacheable; "on demand" = the frontend never auto-fetches.
- `/sentiment` limiter override `10/minute`.

### Frontend
- `api.ts`: `sentimentStatusSchema`, `sentimentResponseSchema`, `api.sentimentStatus`, `api.sentiment`; `ApiError.isUnavailable` (503), `isRateLimited` (429); retry stops on 429/503. `queries.ts`: `useSentimentStatus()` (staleTime Infinity), `useSentiment(symbol, {enabled})` (staleTime HOUR, `retry: false`).
- `src/features/sentiment/sentiment-panel.tsx`: "Analyse news sentiment" button (hidden when disabled), long-running loading state (10–30 s), result (overall `Badge`, diverging score bar, confidence, theme chips, per-article badge + rationale + link, summary, "generated at · cached"), fixed disclaimer "Automated summary of news tone, not investment advice", 429 → retry-after message.
- `src/features/sentiment/sentiment-page.tsx` (route `/sentiment`, nav "Sentiment"; analysts-page template). Mount the panel in Phase 8's `coin-detail.tsx` slot.
- Widget `sentiment`: config `{ symbol: symbolOrFollow }`; badge + score if cached, else a small "Analyse" button (never auto-fetches); size `{w:4,h:6}`.

### Tests
- Python: `tests/fakes.py` `FakeTicker.news` (AAPL 3 items in the `content` shape; MSFT `[]`); `tests/fake_anthropic.py` `FakeAnthropic` (`messages.parse(**kwargs)` records calls; returns a stub with `.parsed_output`/`.stop_reason`; configurable to raise `RateLimitError`/`APIStatusError` or return `refusal`); conftest `sentiment_agent` fixture + `get_sentiment_agent` override. `tests/unit/test_sentiment.py`: disabled → 503 + status false; happy path + clamping; second call cached (one recorded call); no news → `report: null`; refusal → 502; RateLimitError → 503; APIStatusError → 502; system block carries `cache_control`; user message contains all titles. `test_hardening.py`: `/sentiment` override at `1/minute`. `tests/integration/test_sentiment_live.py`: `integration` + skip unless `STOCK_API_ANTHROPIC_API_KEY`.
- Frontend: `sentimentFixture`; MSW `GET /sentiment/status`, `GET /sentiment/:symbol`; `sentiment-panel.test.tsx` (hidden when disabled; click → result + disclaimer; 503 hidden; 429 message), `sentiment-page.test.tsx`, `sentiment-widget.test.tsx`; registry/layout tests.
- e2e: Sentiment tab; read `/sentiment/status` via `page.request`; if disabled assert no button, else click and expect the badge within 60 s + disclaimer.

### Deploy
- Add the key in Render (Manual sync + Approve, then set the secret), redeploy; `curl .../sentiment/status` → `enabled: true`; one live `GET /sentiment/AAPL`, second call `cached: true`; 11th request in a minute → 429.

---

### Cross-cutting
- `session.md`: one entry per phase with checkpoint output; README gains the four sections + env vars.
- Coverage `fail_under = 80`: keep router glue thin, engines pure and fully tested.
- MSW `onUnhandledRequest: 'error'`: add each handler in the same commit as the API client.
- Polish backlog carried over: dialogs instead of `window.prompt/confirm`, Bollinger fill, S/R order scaling, Yahoo `recommendationKey`, pgTAP via `supabase test db --linked`, bundle splitting, `MarketData._history` retry.

### Critical files
- `api/app/services/market_data.py` (search types, `top_crypto`, `closes`, `news`)
- `api/app/ratelimit.py` (per-prefix overrides, one middleware)
- `api/app/main.py` (routers, CORS POST, limiter overrides, sentiment dependency)
- `src/lib/api.ts` (zod schemas, `postJson`)
- `src/lib/dashboard-layout.ts` + `src/features/dashboard/widgets/registry.tsx` (three new widgets)

### Verification (end to end)
- Per phase: ruff + pytest (coverage ≥ 80), oxlint + tsc + vitest + vite build, Playwright against the dev servers, commit/push, Render endpoint probe, Playwright against https://pandagenticsignal.com.
- Final: all four tabs live on the site; dashboard shows Crypto, Portfolio and Sentiment widgets; a saved portfolio round-trips through Supabase; sentiment for AAPL and BTC-USD returns within 30 s and is served from cache on the second call.
