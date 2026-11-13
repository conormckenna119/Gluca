# Decisions

Append new entries with a date. Do not rewrite history; add a superseding entry instead.

## Open: only the owner can decide

| # | Decision | Context | Blocks |
| --- | --- | --- | --- |
| D1 | Product name | Working name is "Gluca". The owner is concerned it may conflict with an unreleased product. A web search on 2026-11-12 found no exact match but many similar "Gluco…" apps. Earlier briefs also used "GlucoClub". Needs a trademark attorney's clearance search. The name lives in `src/art/brand.ts`; rename steps are in `docs/ROADMAP.md` M1 | Public release |
| D2 | Delete `_backup_before_claude/` | Copy of the source before the visual pass | M0 cleanup |
| D3 | Dark or light by default | Currently dark first (`dark: true` in `src/store.tsx`) with a light option | M6 |
| D4 | Is the fictional community (feed, Explore, clubs) visible in the default build, or flagged off so the app is purely share-first? | The share-first brief says to test sharing before building community | M4 |
| D5 | Analytics provider | None today; telemetry is local only. A provider needs a privacy review and consent copy | After M9 |
| D6 | Real health data, backend, paid services, public deployment | All unapproved | M10 |

## Made

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-11-12 | Share-first: the smallest product is "data in, graphic out, you choose to share" | Owner's product direction update |
| 2026-11-12 | Artwork is one SVG string used for both preview and export | Guarantees the export matches the preview; testable without a device |
| 2026-11-12 | Range colours are amber (below), mint (in), lavender (above), always with words | No red or green success coding |
| 2026-11-12 | Demo data label on the image cannot be disabled | Synthetic data must never pass as real |
| 2026-11-12 | Statistics are duration-weighted with a 5-minute cap; gaps are never interpolated | Honest numbers with incomplete data |
| 2026-11-12 | Story safe margins 250 px top and bottom; portrait 110; square 90; plus an 8 px inner buffer | Platform UI overlaps story edges; glyph overshoot must not enter the margin |
| 2026-11-12 | Inter (SIL OFL 1.1) embedded in web exports | Same output on every device |
| 2026-11-12 | Telemetry is a closed enum-only spec, off by default, no remote sink | Health data cannot leak through analytics by construction |
| 2026-11-12 | Logging sheet uses wheel pickers plus a live glucose strip | Owner asked for the iOS alarm-style wheels and left the final choice open |
| 2026-11-12 | No carbohydrate or insulin amounts anywhere | Keeps the product out of dosing and treatment territory |
| 2026-11-13 | Owner approved the drop-with-peak logo in `assets/` | To be applied in-app in M1 |
| 2026-11-13 | `src/art/` is the source of truth for the engine; `prototypes/share-first-web/` is a frozen reference | Avoid maintaining two copies |
