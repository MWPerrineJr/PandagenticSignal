-- pgTAP: indicator_settings is private to its owner. Run with `supabase test db --linked`.
begin;
select plan(7);

select has_table('public', 'indicator_settings', 'indicator_settings table exists');
select col_is_pk('public', 'indicator_settings', 'user_id', 'user_id is the primary key');

-- Two users.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a01', 'a@example.com'),
  ('00000000-0000-0000-0000-000000000b02', 'b@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000a01","role":"authenticated"}';

select lives_ok(
  $$insert into public.indicator_settings (user_id, tokens) values ('00000000-0000-0000-0000-000000000a01', '["rsi:14","sr"]')$$,
  'owner can insert their row'
);
select throws_ok(
  $$insert into public.indicator_settings (user_id, tokens) values ('00000000-0000-0000-0000-000000000b02', '["rsi:14"]')$$,
  '42501',
  null,
  'cannot insert a row for another user'
);
select throws_ok(
  $$update public.indicator_settings set tokens = '["a","b","c","d","e","f","g","h","i"]' where user_id = '00000000-0000-0000-0000-000000000a01'$$,
  '23514',
  null,
  'more than eight tokens is rejected'
);

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000b02","role":"authenticated"}';
select is(
  (select count(*) from public.indicator_settings),
  0::bigint,
  'another user sees no rows'
);
select is(
  (select count(*) from public.indicator_settings where user_id = '00000000-0000-0000-0000-000000000a01'),
  0::bigint,
  'another user cannot read by id either'
);

select * from finish();
rollback;
