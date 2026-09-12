-- Ask every pre-existing account to confirm the disclosure once.
-- The initial backfill marked all existing profiles as accepted with the
-- placeholder version 'pre-2026-09-12'. Clear those so the app shows the
-- confirmation screen at their next sign-in. Genuine acceptances (stamped with
-- a real disclaimer version) are left untouched.

update public.profiles
set disclosure_accepted_at = null,
    disclosure_version = null
where disclosure_version = 'pre-2026-09-12';
