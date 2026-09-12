# Make Login the Landing Page

## What changes for users
- Visiting the root URL `/` always shows the dedicated login page.
- The dashboard moves to `/dashboard`.
- After signing in, users are redirected to `/dashboard`.
- The header navigation updates so the Dashboard link points to `/dashboard`.

## Code changes
- `src/app/routes.tsx` — change the index route to render `<LoginPage />` and add a `/dashboard` route for `<DashboardPage />`.
- `src/components/layout/app-shell.tsx` — update `NAV_ITEMS` so the Dashboard link points to `/dashboard` instead of `/`.
- `src/features/auth/login-page.tsx` — adjust the post-sign-in redirect so users coming from `/` land on `/dashboard` instead of looping back to login.
- `src/components/layout/user-menu.tsx` — update the signed-out link and signed-in redirect behavior if needed.
- Tests: update `login-page.test.tsx` route expectations and any tests that navigate to `/` expecting the dashboard.

## Verification
- Visit `/` and confirm the login page renders.
- Sign in and confirm the redirect lands on `/dashboard`.
- Confirm the Dashboard nav item works and shows the dashboard.
- Confirm signed-in users can still sign out and return to the local-only state.

## Notes
- Deep links to other pages (charts, watchlist, etc.) still work for signed-in users; signed-out visitors who try them will see the login page at `/` unless protected-route behavior is added later.
