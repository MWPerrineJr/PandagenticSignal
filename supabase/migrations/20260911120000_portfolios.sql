-- Portfolios (Phase 9): one row per named portfolio, holdings stored as the API request rows
-- `[{"symbol": "AAPL", "weight": 40}, ...]` or `[{"symbol": "AAPL", "amount": 500}, ...]`.
-- Upsert on id from the client, like dashboard_layouts. Applied to stock-tool-dev on 2026-09-11.

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My portfolio' check (length(name) between 1 and 60),
  holdings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(holdings) = 'array' and jsonb_array_length(holdings) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create index portfolios_user_idx on public.portfolios (user_id);

create trigger portfolios_set_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();

alter table public.portfolios enable row level security;

create policy "portfolios: owner can read" on public.portfolios
  for select to authenticated using (user_id = (select auth.uid()));
create policy "portfolios: owner can insert" on public.portfolios
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "portfolios: owner can update" on public.portfolios
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "portfolios: owner can delete" on public.portfolios
  for delete to authenticated using (user_id = (select auth.uid()));
