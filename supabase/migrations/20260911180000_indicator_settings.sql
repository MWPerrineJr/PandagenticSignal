-- Indicator settings (Phase 12): the chart indicator selection saved to the account, one row
-- per user, as the API request tokens `["ema:10", "bb:20-2", "rsi:14", ...]` (at most 8).
-- Upsert on user_id from the client. Applied to stock-tool-dev on 2026-09-11.

create table public.indicator_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tokens jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tokens) = 'array' and jsonb_array_length(tokens) <= 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger indicator_settings_set_updated_at
  before update on public.indicator_settings
  for each row execute function public.set_updated_at();

alter table public.indicator_settings enable row level security;

create policy "indicator_settings: owner can read" on public.indicator_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "indicator_settings: owner can insert" on public.indicator_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "indicator_settings: owner can update" on public.indicator_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "indicator_settings: owner can delete" on public.indicator_settings
  for delete to authenticated using (user_id = (select auth.uid()));
