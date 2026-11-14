# Decisions

Append new entries with a date. Do not rewrite history; add a superseding entry instead.

## Open: only the owner can decide

| # | Decision | Context | Blocks |
| --- | --- | --- | --- |
| D1 | Product name | Working name is "Gluca". The owner is concerned it may conflict with an unreleased product. A web search on 2026-11-12 found no exact match but many similar "Gluco…" apps. Earlier briefs also used "GlucoClub". Needs a trademark attorney's clearance search. The name lives in `src/art/brand.ts`; rename steps are in `docs/ROADMAP.md` M1 | Public release |
| D2 | Delete `_backup_before_claude/` | Copy of the source before the visual pass | M0 cleanup |
| D3 | Dark or light by default | Currently dark first (`dark: true` in `src/store.tsx`) with a light option | M6 |
| D4 | ~~Is the fictional community visible in the default build?~~ **Decided 2026-11-13: keep visible** (see Made) | | |
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
| 2026-11-13 | Correction to the entry above: the approved logo is not in `assets/`; those files are the stock Expo placeholder. The in-app mark was drawn from the written description (mint drop, near-black single-peak line) | Found during M1. The owner needs to supply the file or approve generating icons from the in-app mark |
| 2026-11-13 | In-app `Mark` draws its peak line in the `accentInk` token | Near-black on the light theme's dark green drop was too faint |
| 2026-11-13 | Owner chose to generate the app icon set from the in-app mark rather than supply a logo file | The original logo file is not in the repository; `tools/make-icons.cjs` makes the set reproducible |
| 2026-11-13 | D4: the fictional feed, Explore and clubs stay visible in the default build. `communityFeed` and `clubs` default to on; turning them off must still remove them from navigation. They stay labelled as a local demo with a fictional community | Owner's choice |
| 2026-11-13 | Create's day picker is built in-app (previous / next buttons plus a sheet listing the days that have data); no date-picker package | A native date picker can only be limited by a minimum and maximum date, not to the days that have data, and has no web version. No new dependency |
| 2026-11-13 | Added `expo-font` and `@expo-google-fonts/inter` | M5: load Inter at app start so the preview and native export use the same face as web exports. Font files ship in the app; nothing is downloaded at run time |
| 2026-11-13 | Added `expo-image-picker` | M5: pick a photo from the library as the background of transparent artwork. The photo stays on the device and is not saved in app state |
| 2026-11-13 | Bottom sheets and confirmations use a `Sheet` primitive built on React Native `Modal`; icons are drawn in `src/ui.tsx` with `react-native-svg` | Works on iOS, Android and web with no sheet or icon package. Not yet run on a phone (M7) |
| 2026-11-13 | M6 design direction: dark-first "calm instrument": one centred column (720 px max), eyebrow labels, large tight numerals, 20 px card radius, chips and icon buttons, at most one filled action per screen; status tone is carried by icon and words, never red or green | Keeps every screen in the same language as Create. D3 (dark or light default) is still the owner's; dark stays the default until decided |
