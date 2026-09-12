# Match the pandagentic.ai look and turn on Fibonacci retracement

Two separate causes, one for each symptom.

## 1. Colors

The new green-on-black brand colors are in the app, and the dark version already
matches pandagentic.ai (checked side by side: both use the same near-black
background #070D0A and neon green #00FF40). What you are most likely seeing is the
**light** version of the app, which is a pale white-green theme and looks nothing
like pandagentic.ai. The app follows your device's light/dark setting, so on a phone
or laptop set to light mode it shows the pale theme.

pandagentic.ai has only one mode: dark. Proposal: do the same here.

- Make the dark brand theme the app's only look, so every visitor sees the
  green-on-black design regardless of their device setting.
- Remove the light/dark toggle from the header (nothing left to switch between).
- Re-check the login page, dashboard, and charts so nothing reads as low contrast
  after the change.

If you would rather keep a light option, say so and I will instead restyle the light
theme closer to the brand and default new visitors to dark.

## 2. Fibonacci retracement

The Fibonacci code is in the project, but the indicator list the app draws from comes
from your separate data service on Render, and that service is still running the older
build: its live indicator list has no Fibonacci entry, so the option never appears in
the chart's indicator picker.

Nothing in this project can fix that — the Render service has to be redeployed from
your GitHub repo. Steps for you:

1. Open the Render dashboard, service `stock-tool-api-qg9s`.
2. Trigger a manual deploy of the latest commit (or enable auto-deploy on push).
3. Once it is live, reload the app; "Fibonacci retracement" will show up in the
   indicator picker and draw yellow dashed levels with ratio labels.

I will re-check the live service after you deploy and confirm the levels render.

## 3. Publish

Frontend changes only reach pandagenticsignal.com after clicking Update in the
publish dialog, so we will publish once the theme change is verified.

## Technical notes

- Theme: drop the system/light branches in the theme provider and pin `dark` on the
  document root; keep the existing CSS variables in `src/index.css` unchanged.
- Chart palette in `src/lib/chart-theme.ts` keeps both entries; only the dark one is
  used after this change.
- Verified: live `/indicators/catalog` on Render returns no `fib` id; the repo's
  `api/app/services/indicators.py` and `levels.py` do define it.
