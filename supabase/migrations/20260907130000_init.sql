-- Applied to stock-tool-dev on 2026-09-07 via the Supabase connector (migration
-- "init_profiles_watchlists_layouts"). Kept here so the CLI can replay it locally or
-- on a fresh project: `supabase db push` / `supabase db reset`.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Watchlist' check (length(name) between 1 and 60),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index watchlists_user_position_idx on public.watchlists (user_id, position);

create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists (id) on delete cascade,
  symbol text not null check (symbol = upper(symbol) and length(symbol) between 1 and 16),
  position integer not null default 0,
  added_at timestamptz not null default now(),
  unique (watchlist_id, symbol)
);
create index watchlist_items_watchlist_position_idx on public.watchlist_items (watchlist_id, position);

create table public.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Default' check (length(name) between 1 and 60),
  layout jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create index dashboard_layouts_user_idx on public.dashboard_layouts (user_id);
create unique index dashboard_layouts_one_default_idx on public.dashboard_layouts (user_id) where is_default;

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger dashboard_layouts_set_updated_at
  before update on public.dashboard_layouts
  for each row execute function public.set_updated_at();

-- Every new auth user gets a profile and one default watchlist.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)));
  insert into public.watchlists (user_id, name, position)
  values (new.id, 'Watchlist', 0);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomically replace a watchlist's symbols (order = position). Runs as the caller, so RLS applies.
create or replace function public.set_watchlist_items(p_watchlist_id uuid, p_symbols text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(array_length(p_symbols, 1), 0) > 20 then
    raise exception 'a watchlist holds at most 20 symbols' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.watchlists w
    where w.id = p_watchlist_id and w.user_id = (select auth.uid())
  ) then
    raise exception 'watchlist not found' using errcode = '42501';
  end if;

  delete from public.watchlist_items
  where watchlist_id = p_watchlist_id
    and not (symbol = any (p_symbols));

  insert into public.watchlist_items (watchlist_id, symbol, position)
  select p_watchlist_id, u.s, (u.ord - 1)::integer
  from unnest(p_symbols) with ordinality as u (s, ord)
  on conflict (watchlist_id, symbol) do update set position = excluded.position;
end;
$$;

revoke all on function public.set_watchlist_items(uuid, text[]) from public;
grant execute on function public.set_watchlist_items(uuid, text[]) to authenticated;

-- Row level security: owner-only on every table.
alter table public.profiles enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.dashboard_layouts enable row level security;

create policy "profiles: owner can read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: owner can insert" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: owner can update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "watchlists: owner can read" on public.watchlists
  for select to authenticated using (user_id = (select auth.uid()));
create policy "watchlists: owner can insert" on public.watchlists
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "watchlists: owner can update" on public.watchlists
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "watchlists: owner can delete" on public.watchlists
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "watchlist_items: owner can read" on public.watchlist_items
  for select to authenticated using (
    exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid()))
  );
create policy "watchlist_items: owner can insert" on public.watchlist_items
  for insert to authenticated with check (
    exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid()))
  );
create policy "watchlist_items: owner can update" on public.watchlist_items
  for update to authenticated using (
    exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid()))
  );
create policy "watchlist_items: owner can delete" on public.watchlist_items
  for delete to authenticated using (
    exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid()))
  );

create policy "dashboard_layouts: owner can read" on public.dashboard_layouts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "dashboard_layouts: owner can insert" on public.dashboard_layouts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "dashboard_layouts: owner can update" on public.dashboard_layouts
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dashboard_layouts: owner can delete" on public.dashboard_layouts
  for delete to authenticated using (user_id = (select auth.uid()));
