Move the logout button to the left side of the app header, below the Pandagentic Signal brand.

Changes
- Update `src/components/layout/app-shell.tsx` to place a "Log out" button underneath the Pandagentic Signal brand link when the user is signed in.
- Update `src/components/layout/user-menu.tsx` to remove the icon-only sign-out button from the right-side cluster; keep the "Sign in" button for signed-out users and the signed-in email display if it remains useful.
- Use the existing `useAuth().signOut` handler and shadcn `Button` component.
- Verify `bun run build` and the login/user-menu tests still pass.
- Spot-check the preview to confirm the logout button sits below the brand on app pages when signed in, and the right side no longer shows the old icon button.

No database or auth logic changes.
