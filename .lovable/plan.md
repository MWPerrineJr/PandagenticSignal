# Rename the app to Pandagentic Signal

## What changes for users
- Browser tab title becomes **Pandagentic Signal**.
- Header logo text changes from "Stock Analysis Tool" to **Pandagentic Signal**.
- Login page logo text changes from "Stock Analysis Tool" to **Pandagentic Signal**.

## Code changes
- `index.html` — update `<title>` to "Pandagentic Signal".
- `src/components/layout/app-shell.tsx` — update the header logo `<span>` text.
- `src/features/auth/login-page.tsx` — update the centered logo text above the sign-in card.

## Verification
- Open the preview and confirm the browser tab and header show **Pandagentic Signal**.
- Navigate to `/login` and confirm the centered logo reads **Pandagentic Signal**.
- Run the affected tests to make sure no assertions relied on the old name.

## Notes
- Internal identifiers stay unchanged: `package.json` name, `render.yaml` service name, localStorage keys (`stock-tool.*`), and Supabase project references remain as-is so existing data and deployments are not disrupted.
- No backend or database changes are needed.
