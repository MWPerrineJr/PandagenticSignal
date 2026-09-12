-- Run this once in the Supabase SQL editor for project stock-tool-dev (agumrmsaeblcldcygajl).
--
-- Disclosure acceptance: every new account must confirm the legal disclosure before it can use
-- the app. The moment of acceptance and the version of the disclaimer text shown are recorded on
-- the profile row, which is already owner-only through the existing RLS policies.

alter table public.profiles
  add column if not exists disclosure_accepted_at timestamptz,
  add column if not exists disclosure_version text;

-- Existing accounts predate the requirement; treat them as already accepted so nobody is locked out.
update public.profiles
set disclosure_accepted_at = coalesce(disclosure_accepted_at, created_at, now()),
    disclosure_version = coalesce(disclosure_version, 'pre-2026-09-12')
where disclosure_accepted_at is null;
