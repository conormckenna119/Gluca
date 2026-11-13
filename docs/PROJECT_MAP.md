# Project map

Root: `C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca`
Last verified against the folder: 2026-11-13.

## Top level

| Path | What it is | Notes |
| --- | --- | --- |
| `AGENTS.md` | Entry point for agents | Rules, commands, working agreement |
| `README.md` | How to run and try on a phone | Keep in step with reality |
| `app/` | Expo Router routes | Thin files that re-export screens |
| `src/` | All app code | See below |
| `src/art/` | Artwork engine | Pure TypeScript, no React Native |
| `tests/` | Core tests and Playwright journey | |
| `tools/test.cjs` | Test runner | Transpiles a fixed file list; see `AGENTS.md` |
| `tools/make-icons.cjs` | Icon generator | `node tools/make-icons.cjs .` renders every file in `assets/` from the drop and peak paths; needs Edge |
| `tools/screenshots.mjs` | Screenshot script | `node tools/screenshots.mjs [outDir]`; 8 routes x 375/430/1280 px x dark/light against a running web server on port 8081; exits 1 on console errors |
| `assets/` | App icon, Android adaptive icon layers, favicon, splash | Generated from the in-app drop-and-peak mark by `tools/make-icons.cjs` (2026-11-13). Do not hand-edit; change the script and re-run |
| `samples/` | Synthetic sample CSV and two reference PNGs | No real data, ever |
| `docs/` | Project docs | See "Docs" below |
| `prototypes/share-first-web/` | Standalone browser prototype of the share-first flow | Reference implementation; not part of the Expo build |
| `app.json` | Expo config | Name, slug, scheme, icons, permission strings |
| `package.json` | Dependencies and scripts | Expo SDK 58, RN 0.88.1, React 19.3, TS ~6.0.3 |
| `tsconfig.json` | Extends `expo/tsconfig.base`, strict | Excludes backup, build output and `prototypes/` |
| `playwright.config.ts` | E2E config | Edge channel, port 8081, 390×844 viewport |
| `.env.example` | Reserved Supabase variables | Nothing is read in demo mode |
| `.gitignore` | Ignore rules | |
| `_backup_before_claude/` | Copy of the source before the visual pass | Ignored by git, so not in history. Delete only once the owner agrees (D2) |
| `.expo/`, `.test-build/`, `dist/`, `test-results/`, `node_modules/` | Generated | Never edit |

Git repository on `main` since 2026-11-13 (baseline commit `a4d3d60`).

## Routes: `app/`

| File | Screen | Exported from |
| --- | --- | --- |
| `app/_layout.tsx` | Root stack, QueryClient, store provider, status bar | itself |
| `app/(tabs)/_layout.tsx` | Tab bar with line icons and raised Create button | itself |
| `app/(tabs)/index.tsx` | Home feed | `Home` in `src/screens/home.tsx` |
| `app/(tabs)/glucose.tsx` | My Glucose dashboard | `Glucose` in `src/screens/glucose.tsx` |
| `app/(tabs)/create.tsx` | Create a graphic | `Create` in `src/screens/create.tsx` |
| `app/(tabs)/explore.tsx` | People and clubs | `Explore` in `src/screens/explore.tsx` |
| `app/(tabs)/profile.tsx` | Profile | `Profile` in `src/screens/profile.tsx` |
| `app/post/[id].tsx` | Post detail and comments | `PostDetail` in `src/screens/post-detail.tsx` |
| `app/settings.tsx` | Settings and privacy | `Settings` in `src/screens/settings.tsx` |
| `app/import.tsx` | CSV import and local export | `ImportScreen` in `src/screens/import.tsx` |

## App code: `src/`

| File | Lines | Responsibility |
| --- | --- | --- |
| `src/types.ts` | 28 | `Reading {timestamp, mgdl, source}`, `Post`, `Visibility`, `State` |
| `src/store.tsx` | 85 | `DemoStore` context, `useDemo()`, seed data (10 fictional people, 24 posts, clubs). Persists to AsyncStorage key `gluca-demo-v1` |
| `src/providers.ts` | 61 | `GlucoseProvider` interface, `synthetic()` generator, Mock and CSV providers, rejecting placeholders for Dexcom / Apple Health / Health Connect |
| `src/analytics.ts` | 95 | App statistics: `convert`, `normalize`, `summarize`, `segments`. Duration-weighted, 5-minute cap |
| `src/csv.ts` | 103 | App CSV parser `parseCsv` (asks for unit, date order and UTC offset) |
| `src/export.ts` | 61 | `exportImage`: web draws SVG to canvas and downloads PNG; native uses view capture, then share sheet or photo library |
| `src/story.ts` | 94 | Adapter between the app and `src/art/`: `StoryOptions`, `defaultOptions`, `switchTemplate`, `pickTone`, `storyArtwork`, `storySvg`, `nativeSafe` |
| `src/ui.tsx` | 174 | Design tokens and primitives |
| `src/screens/home.tsx` | 61 | `Home`; the feed with filters |
| `src/screens/post-detail.tsx` | 51 | `PostDetail`; one post and its comments |
| `src/screens/glucose.tsx` | 183 | `Glucose`; the My Glucose dashboard |
| `src/screens/create.tsx` | 347 | `Create`; artwork preview, options, export and publish to the local feed (also holds `SHOW_LABELS` and `slug`) |
| `src/screens/explore.tsx` | 54 | `Explore`; clubs and community members |
| `src/screens/profile.tsx` | 35 | `Profile` |
| `src/screens/settings.tsx` | 84 | `Settings` |
| `src/screens/import.tsx` | 126 | `ImportScreen`; CSV import and local data export |
| `src/components/page.tsx` | 43 | `Page`; scroll container, title and demo pills |
| `src/components/post-card.tsx` | 133 | `PostCard`; one feed post with its actions |
| `src/components/glucose-chart.tsx` | 51 | `GlucoseChart`; the SVG glucose trace and `areaPath` |
| `src/hooks/use-readings.ts` | 16 | `useReadings`; TanStack Query over the Mock or CSV provider |

## Artwork engine: `src/art/`

Pure functions that turn readings plus settings into one SVG string at exact pixel size. The same SVG is the preview and the export.

| File | Responsibility |
| --- | --- |
| `src/art/brand.ts` | `BRAND.name`, `BRAND.tagline`. Single source of the product name |
| `src/art/formats.ts` | Sizes and safe margins: story 1080×1920 (250 px top and bottom), portrait 1080×1350 (110), square 1080×1080 (90) |
| `src/art/analytics.ts` | Engine statistics on `{t, mgdl}` readings where `t` is wall-clock time; `computeStats`, `segmentsFor`, `cleanReadings`, date helpers |
| `src/art/copy.ts` | Tones (minimal, humorous, motivational, educational, custom), headline and caption lines |
| `src/art/svg.ts` | Colour and contrast helpers, palette builder, text wrapping and fitting, chart, distribution bar, brand mark |
| `src/art/templates.ts` | `buildArtwork(model)` with six templates: `minimal_trace`, `daily_recap`, `transparent_overlay`, `real_side`, `humorous`, `milestone`. Returns `{svg, width, height, contents, hasData, overflow}` |
| `src/art/model.ts` | `Settings`, `defaultSettings`, `withTemplate`, `periodBounds`, `makeArtModel` |
| `src/art/telemetry.ts` | Closed-spec analytics API. **Present but not wired into the app** |
| `src/art/font-data.ts` | Inter (SIL OFL 1.1) subset as base64, embedded in web exports only. Generated; do not hand-edit |

Guarantees tested in `tests/core.test.ts`: every template at every format has the exact size and `overflow === 0`; transparent art has no background layer; user text is escaped; demo data is labelled.

## Data flow

```
providers.ts (synthetic or imported CSV)
   -> useReadings() in src/hooks/use-readings.ts (TanStack Query)
        -> Glucose screen: analytics.ts summarize() + segments() -> react-native-svg chart
        -> Create screen: story.ts storyArtwork() -> art/model.ts -> art/templates.ts -> SVG string
              -> preview: SvgXml (native-safe SVG, no filters or embedded font)
              -> export:  export.ts (web: canvas PNG download; native: captureRef -> share / save)
              -> publish: a Post with an optional numeric snapshot goes into store.tsx (local only)
```

Timestamps: the app stores UTC epoch milliseconds. `story.ts` shifts them to wall-clock time before calling the engine, so a "day" is the person's local midnight to midnight.

## Tests

| File | Runner | Covers |
| --- | --- | --- |
| `tests/core.test.ts` | `npm test` | Conversions, weighted statistics, duplicates, gaps, CSV parsing, providers, all templates and formats, transparency, escaping, native-safe SVG |
| `tests/e2e/journey.spec.ts` | `npm run test:e2e` | Feed, kudos, comment, dashboard, Create, export a 1080×1920 transparent PNG. Updated for the new Create screen first run and passing 2026-11-13 |

## Docs

| File | Purpose |
| --- | --- |
| `docs/PROJECT_MAP.md` | This file |
| `docs/ROADMAP.md` | Remaining milestones with specifications |
| `docs/SKILLS.md` | Skills and expertise per milestone |
| `docs/DECISIONS.md` | Decision log and open owner decisions |
| `docs/product/PRODUCT_VISION.md` | Why the product exists, principles |
| `docs/product/MVP_SCOPE.md` | Share-first MVP scope (written for the web prototype) |
| `docs/product/VALIDATION_PLAN.md` | User-testing plan and assumptions to test |
| `docs/product/SUCCESS_METRICS.md` | What can and cannot be measured |
| `docs/product/FEATURE_ROADMAP.md` | Product-level phases and flags |
| `docs/design/*.png` | Concept mockups: event icons on a trace, meal card post, slide-up logging sheet with wheel pickers, overlay on a photo |
| `docs/CLAUDE_DESIGN_HANDOFF.md` | Original design brief from the first build. Historical |
| `docs/IMPLEMENTATION_PLAN.md` | Original six-phase plan. Superseded by `docs/ROADMAP.md` |
| `docs/INTEGRATIONS.md` | Requirements before connecting Dexcom, Supabase, Apple Health, Health Connect, Instagram |

## The web prototype: `prototypes/share-first-web/`

A no-framework browser app that proves the share-first flow: try demo data or import a Dexcom Clarity CSV, see a graphic at once, export PNG. It has its own `package.json`, 59 unit tests and a Chromium end-to-end script that checks real exports (sizes, alpha, safe margins).

Use it as the reference for three things the Expo app still lacks:

| Prototype file | What to port | Milestone |
| --- | --- | --- |
| `prototypes/share-first-web/src/csv.ts` + `tests/csv.test.ts` | Stronger Clarity parser: preamble and header detection, EGV rows only, "Low"/"High" handling, never keeps patient info | M3 |
| `prototypes/share-first-web/src/flags.ts` | Feature flags, everything beyond the MVP off by default | M4 |
| `prototypes/share-first-web/src/app.ts` | The landing and import flow, wording for export and share status | M4 |
| `prototypes/share-first-web/scripts/e2e.ts` | Export checks to mirror in Playwright | M0, M7 |

Its `src/templates.ts`, `svg.ts`, `copy.ts`, `formats.ts`, `model.ts`, `analytics.ts`, `telemetry.ts`, `brand.ts` and `font-data.ts` are the same code as `src/art/`. **`src/art/` is the source of truth.** If you change the engine, change it in `src/art/` and do not maintain two copies; the prototype is frozen.

## Known problems and debt

| # | Problem | Where | Milestone |
| --- | --- | --- | --- |
| 1 | ~~Restyled screens never run in a browser~~ Resolved for web 2026-11-13; devices remain (see 16) | all of `src/screens/` and `src/components/`, `app/(tabs)/_layout.tsx` | M0 done |
| 2 | ~~Playwright journey not run since the Create rebuild~~ Passing 2026-11-13 | `tests/e2e/journey.spec.ts` | M0 done |
| 3 | ~~Not a git repository; stray `gitignore`~~ Resolved 2026-11-13. Backup folder still present pending D2 | root | M0 done |
| 4 | Android adaptive icon `backgroundColor` is `#E6F4FE`, which may not match the dark icon | `app.json` | M1 |
| 5 | ~~In-app mark is a plain drop~~ Resolved 2026-11-13: drop-and-peak mark in-app and on artwork | `src/ui.tsx` `Mark`, `src/art/svg.ts` `brandMark` | M1 |
| 6 | ~~One 1131-line screens file~~ Resolved 2026-11-13: split into `src/screens/`, `src/components/`, `src/hooks/` | `src/screens/` | M2 done |
| 7 | Two statistics modules and two reading shapes (`{timestamp}` vs `{t}`) | `src/analytics.ts`, `src/art/analytics.ts` | M3 |
| 8 | App CSV parser is weaker than the prototype's | `src/csv.ts` | M3 |
| 9 | Create reads the unit from Settings only when first opened, and always uses the default 70–180 mg/dL range | `Create` in `src/screens/create.tsx` | M3 |
| 10 | Target range on My Glucose is local screen state, not saved | `Glucose` in `src/screens/glucose.tsx` | M3 |
| 11 | Telemetry module not wired; no flags module | `src/art/telemetry.ts` | M4 |
| 12 | No first-run flow; the share-first path takes several taps | `Home`, `Create` | M4 |
| 13 | Native preview and export use the system font and no glow, so they differ from web exports | `src/story.ts` `nativeSafe` | M5 |
| 14 | Date entry is a typed text field | `Create`, `Glucose` | M5 |
| 15 | Explore, Profile, Settings, Import, Post detail only inherited the new primitives; not designed | `src/screens/explore.tsx`, `profile.tsx`, `settings.tsx`, `import.tsx`, `post-detail.tsx` | M6 |
| 16 | Native capture, share sheet and photo-library save unverified on real phones | `src/export.ts` | M7 |
| 17 | Posts have no timestamps or photos; replies are text-prefixed | `src/types.ts`, `src/store.tsx` | M10 |
| 18 | AsyncStorage is unencrypted | `src/store.tsx` | M10 |
| 19 | Educational caption lines not clinically reviewed | `src/art/copy.ts` | M9 |
| 20 | DST days are not adjusted in the artwork engine | `src/art/analytics.ts` | backlog |
| 21 | The 7-day recap uses a single-day headline ("Another day of showing up.") | `src/art/copy.ts`, `src/art/templates.ts` | M5 |
| 22 | The "70" axis label sits on the trace line in the square export | `src/art/svg.ts` chart | M5 |
| 23 | My Glucose chart uses a fixed 20 to 600 mg/dL axis, so the trace is squashed into a thin band and is hard to read | `Glucose` in `src/screens/glucose.tsx` | M6 |
| 24 | ~~App icons are the stock Expo placeholder~~ Resolved 2026-11-13: generated from the in-app mark. Still unverified on devices, and never compared with the owner's original logo file | `assets/`, `tools/make-icons.cjs` | M7 |
