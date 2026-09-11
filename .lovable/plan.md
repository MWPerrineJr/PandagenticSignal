# Remove the Lovable badge

## Goal
Hide the "Edit with Lovable" badge that appears in the bottom-right corner of the published site.

## Current state
- Badge visibility is currently set to `show` (`hide_badge: false`).
- Hiding the badge requires a paid Lovable plan (Pro or higher).

## Steps
1. Call `publish_settings--set_badge_visibility` with `hide_badge: true`.
2. Confirm the setting returns `hide_badge: true`.

## Outcome
The badge will no longer display on the live site at https://pandagenticsignal.com (and the connected misspelled domain).
