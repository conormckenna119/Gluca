# MVP scope

## In scope (shipped in this build)
- No-account web app; works offline once loaded; no network requests (verified in e2e).
- Entry: demo data, local Clarity CSV import, or a milestone graphic with no data.
- Period: one day or 7 days; date picker with previous/next.
- Six templates: minimal trace, daily recap, transparent overlay, "the real side", humorous "shift report", personal milestone.
- Tones: minimal, humorous, motivational, educational, custom, with a shuffle.
- Exports: 1080×1920 story, 1080×1350 portrait, 1080×1080 square, each as opaque PNG or transparent PNG. Story safe margins are 250 px (checked on real exports).
- Optional, removable "Gluca" mark. Demo data is always labelled.
- Share via the browser share sheet where available; otherwise download.
- Customisation (collapsed by default): text, numbers, elements, theme, accent, units (mg/dL, mmol/L), target range.
- "What's on this image" list, remove-imported-data button, local-only feedback.
- Analytics abstraction (off by default), feature flags, tests.

## Primary actions
1. Choose data (demo or import). 2. Pick a template (a good default is already shown). 3. Export.

## Explicitly out of scope (hidden behind flags or not built)
Accounts, cloud sync, Dexcom API, Apple Health, event/meal logging timeline, feed, clubs, recipes, Wrapped, push notifications, payments, any server. None are presented as working.

## Known limits
- Clarity parser written from the known export layout and tested on synthetic files only.
- Times are treated as wall-clock; DST is not adjusted.
- Educational caption text needs clinical/source review before wider use.
- Transparent PNGs may be flattened to black by some apps when posted directly.
- Not tested on iPhone Safari or Android Chrome hardware.
