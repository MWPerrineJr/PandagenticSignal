# Create a Dedicated Login Page

## What changes for users
- The `/login` route becomes a focused, centered sign-in page with the app name and the existing email + Google options.
- A visible **Sign in** button appears in the top-right of the header, so visitors can always find the login page.
- The Google OAuth button stays, and the email form remains below it with the divider.

## Code changes
- `src/features/auth/login-page.tsx` — restyle the login card as a dedicated page: center it vertically, add the app name/logo, keep Google + email flow.
- `src/components/layout/user-menu.tsx` — make the signed-out state show a more prominent **Sign in** button (solid primary style instead of ghost).
- `src/components/layout/app-shell.tsx` — ensure the sign-in control is clearly visible in the header.
- Tests: update `login-page.test.tsx` snapshots/expectations if layout text changes; keep existing auth flow tests.

## Verification
- Navigate to `/login` directly and confirm the page renders centered with the app name and both sign-in options.
- Confirm the header shows a visible **Sign in** button when signed out.
- Click **Continue with Google** and verify it still initiates the OAuth redirect.

## Notes
- No backend or Supabase changes are needed; the existing OAuth setup is reused.
- The page remains public and does not force unauthenticated visitors to log in before viewing the dashboard.
