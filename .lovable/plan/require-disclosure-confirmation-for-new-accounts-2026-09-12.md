# Require disclosure confirmation for new accounts

New users must tick a confirmation box before an account is created, and the acceptance
(date + disclosure version) is saved to their account record.

## What changes for visitors

- On the sign-in page, switching to "Create an account" shows a required checkbox:
  "I have read and accept the disclaimer" with a link to the full disclaimer page.
- "Create account" and "Email me a magic link" (in create mode) stay disabled until it is ticked.
- Google sign-in: first-time Google users land on a short "Confirm the disclosure" step after
  returning from Google and cannot reach the dashboard until they accept. Returning users who
  already accepted go straight through.
- Existing accounts are unaffected — they are treated as already accepted.

## Record kept

Each acceptance stores the moment it happened and which version of the disclaimer text was
shown, so there is an auditable trail per account.

## Technical outline

1. **Migration** `supabase/migrations/<ts>_disclosure_acceptance.sql`
   - `alter table public.profiles add column disclosure_accepted_at timestamptz`,
     `add column disclosure_version text`.
   - Backfill existing rows with `now()` and the current version so current users are not blocked.
   - Existing owner-only RLS on `profiles` already covers read/update; no new policies needed.
   - Applied through the Supabase connector / `supabase db push` against `stock-tool-dev`.
2. **`src/content/disclaimer.ts`** — export the existing `DISCLAIMER_UPDATED` as the version value
   written on acceptance.
3. **`src/auth/auth-provider.tsx`**
   - `signUp(email, password, acceptedDisclosure)` — refuse without acceptance; after a successful
     signup with a session, write the acceptance to `profiles`; when confirmation is pending, store
     the intent and write it on first signed-in load.
   - Expose `disclosureAccepted: boolean | null` derived from the signed-in user's profile row plus
     an `acceptDisclosure()` call that stamps the columns.
4. **`src/features/auth/login-page.tsx`** — checkbox + link in create mode, submit gating, and an
   inline "Confirm the disclosure" panel shown when a signed-in user has no acceptance recorded.
5. **Route guard** — `/dashboard` and other signed-in routes redirect to the confirmation step when
   `disclosureAccepted === false`.
6. **Tests** — extend `src/test/supabase-mock.ts` to fake the profile row; add cases to
   `src/features/auth/login-page.test.tsx`: signup blocked until ticked, acceptance written,
   Google first-timer sees the confirmation step.

## Note

The database change needs to be applied to your Supabase project; the migration file is written
here and applied through the connected project.
