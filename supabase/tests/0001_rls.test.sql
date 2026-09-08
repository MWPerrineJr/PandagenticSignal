-- pgTAP row-level-security tests. Run with `supabase test db` (local stack) or
-- `supabase test db --linked` (against the linked project). Everything runs inside a
-- transaction that pgTAP rolls back, so the throwaway users never persist.
begin;
select plan(10);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'a@rls-test.local', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'b@rls-test.local', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

select is(
  (select count(*) from public.watchlists where user_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')),
  2::bigint,
  'signup trigger creates one default watchlist per user'
);

create temp table ids as
  select (select id from public.watchlists where user_id = '11111111-1111-4111-8111-111111111111') as a_list;
grant select on ids to authenticated, anon;

-- User A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is((select count(*) from public.watchlists), 1::bigint, 'A sees only their own watchlist');
select lives_ok($$select public.set_watchlist_items((select a_list from ids), array['AAPL','MSFT','NVDA'])$$, 'A can set items');
select is((select string_agg(symbol, ',' order by position) from public.watchlist_items), 'AAPL,MSFT,NVDA', 'items keep the given order');
select lives_ok($$select public.set_watchlist_items((select a_list from ids), array['NVDA','AAPL'])$$, 'A can reorder and remove');
select is((select string_agg(symbol, ',' order by position) from public.watchlist_items), 'NVDA,AAPL', 'reorder + remove applied');

-- User B
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is((select count(*) from public.watchlist_items), 0::bigint, 'B cannot read A''s items');
select throws_ok($$select public.set_watchlist_items((select a_list from ids), array['HACK'])$$, '42501', 'watchlist not found', 'B cannot write A''s list through the RPC');
select throws_ok($$insert into public.watchlist_items (watchlist_id, symbol, position) values ((select a_list from ids), 'HACK', 9)$$, '42501', null, 'B cannot insert into A''s list directly');

-- Anonymous
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*) from public.watchlists), 0::bigint, 'anon sees no watchlists');

reset role;
select * from finish();
rollback;
