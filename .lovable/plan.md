# Add Google Sign-In

## What changes for users
- The sign-in page gains a **"Continue with Google"** button. Visitors can sign in with their Google account instead of email/password.
- Google sign-in lands them on the same dashboard and syncs the same watchlist/portfolio data — the existing account system is reused, so nothing else changes.

## One manual step you'll need to do (requires your Google account)
Google sign-in can't be enabled without a Google OAuth client, and only you can create one in your Google account. I'll build the code side; you complete the provider setup:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** (Web application).
2. Add the authorized redirect URI from your Supabase project dashboard (Authentication → Sign In / Providers → Google shows it: `https://agumrmsaeblcldcygajl.supabase.co/auth/v1/callback`).
3. In the Supabase dashboard → Authentication → Providers → **Google**: enable it and paste the Client ID and Client Secret.
4. In Supabase → Authentication → URL Configuration, add your site URLs (`https://pandagenticsignal.com`, plus the Lovable preview URL) to the allowed redirect URLs.

## Code changes (this chat)
- `src/auth/auth-provider.tsx` — add a `signInWithGoogle()` method using `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: ... } })`, preserving the page the user came from.
- `src/features/auth/login-page.tsx` — add a **Continue with Google** button above the email form, with a divider between the two options.
- `src/components/layout/user-menu.tsx` — no change needed; signed-in state works the same regardless of provider.
- Tests: extend `login-page.test.tsx` (and the Supabase mock) to cover the Google button initiating OAuth.

## Verification
- Unit test: clicking "Continue with Google" calls the OAuth flow with the right redirect.
- After you finish the Supabase/Google setup (steps above), try the button on the live site to confirm the round trip.

## Notes
- This project uses your own connected Supabase project, so provider keys live in your Supabase dashboard — nothing secret is stored in the code.
- If Google sign-in is clicked before the provider is enabled in Supabase, Google will show an error — complete the manual steps first, or test after.
