# Stage 8A.5 - export-to-feed

server/posts.ts and post-image.ts add protected PNG publication/image reads/deletion via migration 7 on the existing backend. services/feed-posts.ts and hooks/use-feed-posts.ts merge account posts into the existing Post feed without persisting them in AsyncStorage. Existing PublishCard configures the export; exportImage retains its exact PNG for retries. Existing shared post/identity/unlock/editor components are reused. See STORY_EDITOR.md, UI_REFINEMENT.md and FUTURE_UX_ENHANCEMENTS.md.

# Stage 8A - explicit account medals

Existing registry/Medal/sheets/toasts/Create reused. New src/achievements/events.ts owns event eligibility and pin/order/privacy. server/achievements.ts adds authenticated encrypted owner persistence via migration 6. Existing Create/publish/comment/Boost/Log success handlers emit minimal receipts. Public profile allowlist requires collection plus individual visibility. Tests: achievement-events, server-achievements, e2e/stage8a. Guides: ACHIEVEMENT_SYSTEM.md, ACHIEVEMENT_SAFETY.md, TROPHY_CABINET.md.

#

## Stage 7C — scoped UI audit

`docs/UI_UX_AUDIT.md` records the prioritized review and 66 before/66 after route-layout checks. Existing Create web/native interaction adapters support tap-again exit (web Escape too), with drag/pinch suppression; `photo-background.tsx` guards pending/unmounted results and Create scopes it by session version. Create memoizes its existing selected-period filter. Shared `ui.tsx` Sheet owns its dialog label/footer inset; IdentitySheet removes duplicate padding without changing shield artwork. Explore, empty comments and the connection panel receive static copy edits. New `tests/e2e/stage7c.spec.ts` covers the audit/exit/photo/modal cases; the old mocked Create fixture uses a matching local origin and explicit manual flags. No new backend, data model or dependency.

## Stage 7B — identity refinement

Existing `components/identity/Shield`, `EmblemBadge`, `NameLine`, `IdentitySheet` and `UserIdentity`/`AuthorIdentity` own all updated rendering. Flat shields retain stored colour IDs and date math; `domain/shield.ts` adds date-value-free precision explanations and neutral labels. Emblems reuse `domain/emblems.ts`. Shared identity metadata places existing fictional/owner markers beneath names in post-card/post-detail. Profile's owner-only shield card reuses the detail sheet; public projections/schema/backend are unchanged. `application-shell.tsx` pops details before selecting the existing tab to avoid revealing retained onboarding after profile edits. New tests: `shield-refinement.test.ts`, `e2e/stage7b.spec.ts`; [report and synthetic screenshots](IDENTITY_UI_REFINEMENT.md).

## Stage 7A.5 — grouped story editing

`src/overlay-transform.ts` defines normalized placement/uniform scale/opacity and shared SVG composition. Create owns session-only transform state separately from data/photo/options. New `components/create/overlay-interaction` and `editor-slider` have web/native adapters; `overlay-controls.tsx` uses existing primitives. `artwork-preview.tsx` keeps editing chrome and matte outside the capture surface. `art/templates.ts` marks the mandatory source disclosure so it stays pinned/full opacity. Existing export renderer, backend and glucose calculations remain unchanged. `art/copy.ts` owns optional tones and neutral defaults; `story.ts` / `art/model.ts` preserve user-written words across style/period changes. New tests: `overlay-transform.test.ts`, `e2e/stage7a5.spec.ts`; synthetic evidence: `docs/screenshots/stage7a5`. Guides: [STORY_EDITOR](STORY_EDITOR.md), [voice](GLUCA_VOICE_AND_TONE.md), [verification/file report](UI_REFINEMENT.md).

## Stage 7A focused fixes

`src/components/application-shell.tsx` wraps the root Stack in `app/_layout.tsx`; `primary-nav-icons.tsx` reuses the original icons. `app/(tabs)/_layout.tsx` retains its screens without a duplicate bar. `src/nav.ts` owns visibility/selection and recursive navigator-key targeting through SDK 58's synthetic root. `src/story-composition.ts` provides background policy and explicit photo/foreground layer styles consumed by Create/artwork-preview. `server/static.ts` now serves the existing account route. Unit/browser regressions and PNG helpers are listed in [UI_BUGFIXES_STAGE7A.md](UI_BUGFIXES_STAGE7A.md).


## Stage 6B profile/identity additions

`server/profiles.ts` reuses existing authenticated routes, AES-GCM helper and additive `user_profiles` migration 5 in server/db.ts. Own GET/POST and authenticated public-shaped lookup have separate responses. `src/services/profile.ts` is the same-origin transport; existing DemoStore hydrates owner profiles, prevents stale-account writes, preserves legacy local records and excludes new profiles from global persistence.

`src/screens/onboarding.tsx` remains the route-facing export; new `onboarding-flow.tsx` is the progressive screen. Existing reusable input helpers moved to `components/identity/question-fields.tsx` for onboarding/editor reuse. `profile-fields.tsx` provides live public preview, handle/bio/photo; `profile-save.tsx` commits explicit changes. `user-identity.tsx` is shared across profile, posts/comments and existing people/following displays; NameLine, Shield, EmblemBadge, IdentitySheet and domain date/privacy calculations are reused. `domain/profile-experience.ts` centralizes seven community choices and public-field validation. Existing identity-preview remains a development gallery.

Metadata-only session invalidation distinguishes account changes from provider disconnect, so disconnect stops private glucose work without removing a signed-in user's profile. Cross-tab invalidation also runs for identity-only builds; old enum messages remain accepted. No private payload travels in this channel. New tests: server-profiles/profile-experience plus persistence/session-event extensions. See the three Stage 6B docs for setup, privacy and limitations.


## Stage 5 data flow and files

`app/_layout.tsx` wraps existing store/navigation with `src/glucose-context.tsx`. One `GlucoseSync` (`src/glucose-sync.ts`) uses `src/services/glucose-sync-transport.ts` → existing authenticated relay/token vault. `server/dexcom/status.ts` shares status/session/connection cache metadata between routes and live verification. EGVs remain transient on the server.

Cache contract/memory merge: `src/glucose-cache.ts`. Web factory: `src/private-glucose-cache.ts` (ephemeral). Native factory: `src/private-glucose-cache.native.ts` (SQLCipher/SecureStore key); transaction core: `src/encrypted-glucose-cache.ts`. Native handoff/device verification stays gated. Invalidation: `src/services/session-events.ts`. Persistence exclusion/legacy CSV cleanup: `src/private-persistence.ts`, consumed by store.tsx and displayed through components/page.tsx.

`src/components/glucose-sync-status.tsx` is reused by dashboard/Create/Settings. Hooks use-readings/use-create-readings consume shared history without persisted private query caches. CSV/demo remain available. Private Dexcom readings never enter the social store. `server/dexcom/sync-verification.ts` extends the existing live command with --sync. New tests: glucose-sync, glucose-cache, private-persistence, session-events, server-cache-scope. [Sync/security details](GLUCOSE_SYNC.md).


Stage 4 update (2026-11-16): `src/create-source.ts` shares provider/day selection and story verification; `src/hooks/use-create-readings.ts` owns explicit Create sources and transient Dexcom rows. Existing `src/screens/create.tsx`, `src/story.ts`, `src/art/model.ts` and `templates.ts` reuse templates/analytics/export with UTC sandbox provenance. `server/dexcom/devices.ts` validates minimal private G7 evidence; `sandbox-verification.ts` drives the explicit live check through existing relay code. `tools/test-dexcom-sandbox.cjs` runs `npm run test:dexcom:sandbox`, writing only a derived graphic into ignored `.dexcom-verification/`. Unit tests: `tests/dexcom-create.test.ts`; separate mock browser test/config: `tests/e2e/dexcom-create.spec.ts`, `playwright.dexcom-create.config.ts`. [Live results and repeat instructions](DEXCOM_SANDBOX_TEST_RESULTS.md).

Stage 3 update (2026-11-16): `server/dexcom/relay.ts` authenticates transient V3 dataRange/EGV requests; `src/services/dexcom-data.ts` supplies the memory-only provider; `src/glucose-window.ts` validates UTC periods; `src/glucose-periods.ts` wraps shared analytics for UTC days/weeks. `app/dexcom-data.tsx` reexports the development viewer screen. `tests/dexcom-data.test.ts` uses synthetic fixtures; `tools/dexcom-check.cjs` checks readiness without secrets/network. Setup, complete changed-file map and limitations: [DEXCOM_STAGE3.md](DEXCOM_STAGE3.md). No permanent glucose storage or normal dashboard data path change.

| 26 | ~~Resolved 2026-11-13 (M6)~~ | 23 | ~~Resolved 2026-11-13 (M6)~~ | 22 | ~~Resolved 2026-11-13 (M5)~~ | 21 | ~~Resolved 2026-11-13 (M5)~~ | 15 | ~~Resolved 2026-11-13 (M6)~~ | 13 | ~~Resolved 2026-11-13 (M5, web only; phones in M7)~~ Project map

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
| `app/welcome.tsx` | First-run welcome | `Welcome` in `src/screens/welcome.tsx` |

## App code: `src/`

| File | Lines | Responsibility |
| --- | --- | --- |
| `src/types.ts` | 28 | `Reading {timestamp, mgdl, source}`, `Post`, `Visibility`, `State` |
| `src/store.tsx` | 85 | `DemoStore` context, `useDemo()`, seed data (10 fictional people, 24 posts, clubs). Persists to AsyncStorage key `gluca-demo-v1` |
| `src/providers.ts` | 61 | `GlucoseProvider` interface, `synthetic()` generator, Mock and CSV providers, rejecting placeholders for Dexcom / Apple Health / Health Connect |
| `src/analytics.ts` | 86 | Thin adapter over the engine: `convert`, `normalize`, `wall` (the one UTC to wall-clock conversion), `toEngine`, `summarize`, `segments` |
| `src/csv.ts` | - | Clarity-aware parser `parseCsv(text, options)`: header detection, EGV rows only, unit from header or `needsUnit`, Low/High flags, rejected rows with line numbers. Returns a result object; never throws; keeps no patient info |
| `src/state.ts` | - | Pure helpers: `loadState` (merge and validate saved state, `seenWelcome`), range helpers, `hasImported`, `removeImported` |
| `src/flags.ts` | - | Feature flags: `DEFAULT_FLAGS`, `configureFlags`, `isEnabled`, `getFlags`. Overrides from `EXPO_PUBLIC_FLAGS` |
| `src/nav.ts` | - | Which tabs, links and routes exist for a set of flags: `tabVisible`, `linkVisible`, `redirectFor` |
| `src/components/guard.tsx` | - | Wraps a flagged route and redirects to `/create` when its flag is off |
| `src/telemetry.ts` | - | App glue for the closed telemetry spec: `configureTelemetry`, `track`, enum mappers. Off unless `EXPO_PUBLIC_TELEMETRY=local` |
| `src/screens/welcome.tsx` | - | First-run screen with three share-first actions |
| `src/components/range-inputs.tsx` | - | Target low/high inputs shared by My Glucose and Settings; writes `state.range` in mg/dL only when valid |
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
| `src/components/page.tsx` | - | `Page`; scroll container, title, subtitle and demo pills |
| `src/components/create/` | - | Parts of the Create screen: `artwork-preview`, `photo-background`, `template-strip`, `day-picker`, `export-panel`, `customize` (bottom sheet), `publish-card` |
| `src/days.ts`, `src/time.ts`, `src/chart-scale.ts`, `src/cover-fit.ts` | - | Pure helpers with tests: days that have data; relative time; chart domain and ticks; cover-fit crop for photo backgrounds |
| `src/events.ts`, `src/screens/log.tsx`, `app/log.tsx`, `src/components/wheel.tsx` | - | Event logging behind `eventLogging`: pure event helpers, the `/log` form sheet, the snapping wheel picker |
| `docs/DEVICE_TESTS.md` | - | Blank checklist for the owner's real-phone pass (M7) |
| `src/domain/profile.ts`, `reactions.ts`, `achievements.ts` | - | Pure models and sanitizers for identity and privacy, Boosts and other reaction kinds, achievement definitions and awards |
| `docs/DEXCOM_INTEGRATION.md` | - | Dexcom V3 facts checked against the official docs on 2026-11-16, each marked verified or not |
| `src/domain/shield.ts`, `public-view.ts`, `onboarding.ts`, `communities.ts` | - | Shield tiers and completed-years maths; what others may see of a profile; the conditional onboarding flow; community catalogue and suggestions |
| `src/components/identity/` | - | `Shield`, `EmblemBadge`, `IdentitySheet`, `NameLine`, `PartialDateInput` |
| `src/achievements/` | - | Engine, registry, life and community rules, challenges, period keys, and the flagged health prototype (`eligibility.ts`, `health.ts`) |
| `src/components/achievements/`, `src/screens/trophies.tsx`, `src/hooks/use-achievements.ts` | - | Medal artwork, medal sheet, unlock toast, pinned medals, challenge list, the Medals screen, and the hook that awards medals |
| `src/components/boost-button.tsx`, `src/reaction-copy.ts` | - | The Boost reaction and all of its wording in one place |
| `src/demo-members.ts` | - | Fictional public profiles for the ten demo people |
| `src/screens/onboarding.tsx`, `profile-edit.tsx`, `identity-preview.tsx` | - | Optional profile set-up, profile editing, and a development-only gallery of shields and emblems |
| `src/fonts.ts` | - | Loads Inter with `expo-font` and tells `src/story.ts` which family to use per weight |
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
| `tests/core.test.ts` | `npm test` | Conversions, weighted statistics, duplicates, gaps, providers, all templates and formats, transparency, escaping, native-safe SVG, brand mark |
| `tests/stats.test.ts` | `npm test` | The statistics rules, `wall()`, and that My Glucose and Create agree |
| `tests/csv.test.ts` | `npm test` | Parser cases ported from the prototype; the sample file against an independent calculation; no patient info in the result |
| `tests/settings.test.ts` | `npm test` | Saved-state loading, range validation, unit and range reaching the artwork |
| `tests/flags.test.ts`, `tests/nav.test.ts` | `npm test` | Flag defaults and parsing; which tabs, links and routes exist per flag set |
| `tests/telemetry.test.ts` | `npm test` | Enum-only payloads for every wired event; off mode records nothing |
| `tests/welcome.test.ts` | `npm test` | `seenWelcome` for new installs and old saved state; removing imported data |
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
| 7 | ~~Resolved 2026-11-13 (M3)~~ Two statistics modules and two reading shapes (`{timestamp}` vs `{t}`) | `src/analytics.ts`, `src/art/analytics.ts` | M3 |
| 8 | ~~Resolved 2026-11-13 (M3)~~ App CSV parser is weaker than the prototype's | `src/csv.ts` | M3 |
| 9 | ~~Resolved 2026-11-13 (M3)~~ Create reads the unit from Settings only when first opened, and always uses the default 70–180 mg/dL range | `Create` in `src/screens/create.tsx` | M3 |
| 10 | ~~Resolved 2026-11-13 (M3)~~ Target range on My Glucose is local screen state, not saved | `Glucose` in `src/screens/glucose.tsx` | M3 |
| 11 | ~~Resolved 2026-11-13 (M4)~~ Telemetry module not wired; no flags module | `src/art/telemetry.ts` | M4 |
| 12 | ~~Resolved 2026-11-13 (M4)~~ No first-run flow; the share-first path takes several taps | `Home`, `Create` | M4 |
| 13 | Native preview and export use the system font and no glow, so they differ from web exports | `src/story.ts` `nativeSafe` | M5 |
| 14 | Date entry is a typed text field on My Glucose (Create now has previous / next and a day sheet, M5) | `src/screens/glucose.tsx` | backlog |
| 27 | With "7 days" selected, the image uses week wording but the Headline box in Customize still shows the day wording | `src/components/create/customize.tsx`, `src/art/model.ts` | backlog |
| 28 | Stat tiles on My Glucose have uneven heights at 1280 px | `src/screens/glucose.tsx` | backlog |
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
| 29 | `src/ui.tsx` has no chevron-up icon (the wheel rotates chevron-down) and `Input` has no placeholder prop (the log label field is a local `TextInput`) | `src/ui.tsx` | backlog |
| 25 | A dev server left running for many hours can serve compressed bundles very slowly (about 10 s per load), timing out the e2e journey. Restart it, or use `E2E_BASE_URL` with a fresh server on another port | dev tooling | note |
| 26 | With `communityFeed` and `clubs` off, the page header still shows the "Fictional community" pill | `src/components/page.tsx` | M6 |

## Stage 2 map update — 2026-11-16

The earlier no-backend description is historical. server/index.ts starts the existing Node service; server/session.ts handles sandbox account auth, server/limits.ts request throttles, server/static.ts serves dist only, server/routes.ts manages OAuth, and server/dexcom/oauth.ts + client.ts handle server-held encrypted credentials/refresh. server/db.ts has additive account/connection migrations. Earlier glucose ingestion modules remain dormant; data routes return 501.

src/services/dexcom-oauth.ts is the connection-only cookie client; src/components/dexcom-connection.tsx renders the gated Settings panel. It does not enter the useReadings/provider pipeline. playwright.oauth.config.ts and tests/e2e/dexcom-oauth.spec.ts describe a synthetic browser flow; tests/server-stage2.test.ts, server-static.test.ts and dexcom-oauth-client.test.ts add security/contract coverage. docs/OAUTH_SETUP.md is the current setup/evidence guide.
