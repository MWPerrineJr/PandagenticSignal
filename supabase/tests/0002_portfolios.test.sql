-- pgTAP tests for the portfolios table. Run with `supabase test db` or `supabase test db --linked`.
begin;
select plan(8);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'a@rls-test.local', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'b@rls-test.local', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

-- User A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.portfolios (id, user_id, name, holdings)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Growth', '[{"symbol":"AAPL","weight":60},{"symbol":"BTC-USD","weight":40}]')$$,
  'A can insert a portfolio'
);
select throws_ok(
  $$insert into public.portfolios (user_id, name, holdings) values ('11111111-1111-4111-8111-111111111111', 'Bad', '{"symbol":"AAPL"}')$$,
  '23514', null, 'holdings must be a JSON array'
);
select throws_ok(
  $$insert into public.portfolios (user_id, name, holdings)
    values ('11111111-1111-4111-8111-111111111111', 'Too many', (select jsonb_agg(jsonb_build_object('symbol', 'S' || g, 'weight', 1)) from generate_series(1, 21) g))$$,
  '23514', null, 'at most 20 holdings'
);
select throws_ok(
  $$insert into public.portfolios (user_id, name) values ('22222222-2222-4222-8222-222222222222', 'Spoof')$$,
  '42501', null, 'A cannot insert a row for B'
);
select lives_ok(
  $$update public.portfolios set holdings = '[{"symbol":"MSFT","amount":500}]' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'A can update their portfolio'
);
select is((select updated_at > created_at from public.portfolios where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), true, 'updated_at trigger fires');

-- User B
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is((select count(*) from public.portfolios), 0::bigint, 'B cannot read A''s portfolios');

-- Anonymous
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*) from public.portfolios), 0::bigint, 'anon sees no portfolios');

reset role;
select * from finish();
rollback;
