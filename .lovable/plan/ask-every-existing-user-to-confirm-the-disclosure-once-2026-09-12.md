# Ask every existing user to confirm the disclosure once

## Why nothing was asked

The database script you ran marked all accounts that already existed as "already accepted" (so nobody would be blocked). Your account was one of them, so sign-in went straight through. The app's checking logic itself is working.

## What will change

- Clear the pre-filled acceptance on accounts that never actually confirmed, so the confirmation step appears for them at next sign-in.
- Everyone who signs in without a recorded acceptance sees the confirmation screen once; after accepting, the date and disclaimer version are saved and they are never asked again.
- Accounts that genuinely accepted (through the new sign-up checkbox or the confirmation screen) are untouched.
- Also cover people signing in with Google who have no account record yet: they get the confirmation screen instead of slipping past.

## Steps

1. Provide an updated SQL snippet to run in the Supabase SQL editor that clears the placeholder acceptance rows.
2. Make the app treat "no account record found" as not yet accepted, rather than letting the visitor through.
3. Keep a safety valve: if the two new fields are missing entirely, the app still lets people in rather than locking everyone out.
4. Update the automated tests for both cases and run the build.

## Technical notes

- SQL: `update public.profiles set disclosure_accepted_at = null, disclosure_version = null where disclosure_version = 'pre-2026-09-12';` written to `supabase/disclosure-acceptance-reset.sql`.
- `src/auth/auth-provider.tsx`: in the profile load effect, distinguish a query error (columns absent -> allow) from `data === null` (no profile row -> `setDisclosureAccepted(false)`).
- The existing `DisclosureGate` in `src/app/routes.tsx` and the `ConfirmDisclosure` panel in `src/features/auth/login-page.tsx` already handle the redirect and confirmation UI; no change needed there.
- Tests: extend `src/features/auth/login-page.test.tsx` and `src/test/supabase-mock.ts` for the missing-profile case.

## Your one manual step

Run the new SQL file in the Supabase SQL editor after this is built.
