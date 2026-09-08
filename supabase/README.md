# Supabase

Project: **stock-tool-dev** (`agumrmsaeblcldcygajl`, us-east-2). Schema lives in `migrations/`
and was applied through the Supabase connector; the files are the source of truth for replays.

```bash
brew install supabase/tap/supabase
supabase link --project-ref agumrmsaeblcldcygajl   # asks for the database password once
supabase db push                                    # apply any migration not yet on the project
supabase test db --linked                           # pgTAP tests in tests/ against the project
```

Tables: `profiles`, `watchlists`, `watchlist_items`, `dashboard_layouts`; all owner-only via RLS.
A trigger on `auth.users` creates the profile and a default watchlist. The app writes the
watchlist through `set_watchlist_items(watchlist_id, symbols[])`, which replaces the list
atomically (max 20 symbols) and runs as the caller so RLS applies.
