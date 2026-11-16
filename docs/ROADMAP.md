# Roadmap and specifications

Root: `C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca`. Read `AGENTS.md` first.

Work the milestones in order unless a milestone says it is independent. Each one is sized for a single focused session. When you finish one, tick it here and add a dated note saying what you verified and what you did not.

| # | Milestone | Status | Depends on |
| --- | --- | --- | --- |
| M0 | Baseline: run it, fix what breaks, set up git | done 2026-11-13 (step 8 awaits owner, D2) | none |
| M1 | Brand alignment: logo, icon config, name decision | done 2026-11-13 (name step waits for D1; icons unverified on devices) | M0 |
| M2 | Split `src/screens.tsx` | done 2026-11-13 | M0 |
| M3 | One data layer: analytics, CSV, units and range | done 2026-11-13 | M2 |
| M4 | Share-first first run, flags, local telemetry | done 2026-11-13 | M3 |
| M5 | Create screen polish | done on web 2026-11-13 (native font, glow, photo and sheet unverified until M7) | M3 |
| M6 | Design pass on the remaining screens | done on web 2026-11-13 (D3 still open; dark stays default) | M2 |
| M7 | Real-device verification | checklist ready 2026-11-14 (`docs/DEVICE_TESTS.md`); needs the owner with real phones | M5 |
| M8 | Event logging on the trace (flagged) | done on web 2026-11-14, flag off by default; phones unverified | M5 |
| M9 | Validation with real people and copy review | not started | M7 |
| M10 | Backend, accounts, integrations, release | needs owner approval | M9 |
| M11 | Foundations for identity, Boosts, achievements and Dexcom | done 2026-11-16 | M8 |
| M12 | Identity shields, onboarding, privacy, Boosts, communities | not started | M11 |
| M13 | Achievements: engine, life and community medals, trophy cabinet, health prototype (flag off) | not started | M11 |
| M14 | Dexcom sandbox integration (local backend) | not started; live check needs the owner's credentials | M11 |
| M15 | Docs and close-out for M12 to M14 | not started | M12, M13, M14 |

M5 and M6 can run in parallel after M3 and M2. M8 is optional before M9.

---

## M0. Baseline: run it, fix what breaks, set up git

**Goal.** A known-good starting point. The visual pass was type-checked and unit-tested but never run.

**Files.** Everything in `app/` and `src/`; `tests/e2e/journey.spec.ts`; `.gitignore`; `gitignore`; `_backup_before_claude/`.

**Steps.**
1. `npm install`, then `npm run typecheck` and `npm test`. Both must pass before you change anything. If they do not, stop and fix that first.
2. `git init`, commit the current state as "Baseline after visual pass". Merge any useful lines from the stray `gitignore` into `.gitignore`, then delete `gitignore`. Add `prototypes/share-first-web/dist/` and `prototypes/share-first-web/node_modules/` to `.gitignore`.
3. `npm run web`. Open every route: `/`, `/glucose`, `/create`, `/explore`, `/profile`, `/settings`, `/import`, and a post detail. Fix runtime errors and console errors. Likely trouble spots: `SvgXml` with the artwork SVG on web; `useWindowDimensions` sizing of the Create preview; the tab icon components; the gradient `fill="url(#fade)"` on the glucose chart.
4. In Create, switch through all six templates, three formats, transparent on and off, Day and 7 days. Export a PNG for each format and confirm the pixel size.
5. Run `npm run test:e2e` (needs Microsoft Edge). Fix the journey or the app until it passes. The journey expects the file name `gluca-transparent-overlay-transparent-story.png` and an RGBA 1080×1920 PNG.
6. `npx expo export --platform web` must succeed.
7. Save screenshots of every screen at 375, 430 and 1280 px wide, dark and light, into `docs/screenshots/baseline/`.
8. Ask the owner whether `_backup_before_claude/` can be deleted. Deleting needs their yes.

**Acceptance.**
- Typecheck clean, `npm test` passing, e2e passing, web export succeeding.
- No console errors on any route.
- No horizontal scroll at 375 px on any screen.
- Baseline screenshots committed.
- A git history exists.

**Out of scope.** Redesign. Only fix what is broken.

**Note, 2026-11-13 (M0 done).**
- Verified: `npm run typecheck` clean; `npm test` 14/14; `npm run test:e2e` 1 passed (run twice); `npx expo export --platform web` succeeds. All 8 routes load in Edge at 375 and 1280 px with no console errors, page errors or failed requests, and no horizontal scroll. Create: 72 combinations (6 templates x 3 formats x transparent on/off x Day/7 days) render a preview; exports are RGBA PNGs at exactly 1080x1920, 1080x1350 and 1080x1080. No code changes were needed.
- Git: repository created on `main`, baseline commit `a4d3d60`. Stray `gitignore` merged into `.gitignore` and deleted. `_backup_before_claude/` is ignored by git, so it is not in history.
- Screenshots: 48 files in `docs/screenshots/baseline/` (8 routes x 375/430/1280 x dark/light), made with `node tools/screenshots.mjs [outDir]` against a running web server. Six of the 48 were looked at by eye.
- Not verified: native iOS and Android (M7); the production `dist/` bundle was built but not served and loaded; only the square export image was inspected by eye.
- Not done: step 8. Deleting `_backup_before_claude/` waits for the owner's answer to D2.
- Cosmetic findings, logged in `docs/PROJECT_MAP.md` as problems 21 to 23, not fixed here.

---

## M1. Brand alignment

**Goal.** One consistent mark everywhere, correct icon config, and the name decision recorded.

**Background.** The owner likes the logo in `assets/icon.png` and `assets/favicon.png`: a mint drop (`#91E6B2`) on near-black (`#101412`) with a dark single-peak line across the lower half of the drop. The in-app mark and the mark on exported graphics are currently a plain drop.

**Files.** `src/ui.tsx` (`Mark`), `src/art/svg.ts` (`brandMark`, `DROP_PATH`), `app.json`, `src/art/brand.ts`, `tests/core.test.ts`.

**Steps.**
1. Draw the peak line as an SVG path on the existing 36×36 drop (`M18 2 C28 16 34 24 34 32 a16 16 0 0 1 -32 0 C2 24 8 16 18 2 Z`). Match the shape in `assets/icon.png` by eye: a flat line that rises to one rounded peak in the middle, round caps, stroke about 2.6 units in near-black. Use the same path data in both `Mark` and `brandMark`.
2. On artwork, the peak line colour must contrast with the drop fill for every accent swatch, including white. Use the artwork background colour for opaque art and near-black for transparent art.
3. In `app.json`, set `android.adaptiveIcon.backgroundColor` to `#101412` if the foreground layer is the mint drop (check `assets/android-icon-foreground.png` first). Add `"backgroundColor": "#101412"` at the `expo` level and a matching splash background.
4. Name: see `docs/DECISIONS.md` item D1. Do not rename without the owner's decision. If they choose a new name, change `src/art/brand.ts`, then `name`, `slug`, `scheme` and the two permission strings in `app.json`, `name` and `description` in `package.json`, the storage key in `src/store.tsx` only with a migration, and the export file-name prefix in `Create`.

**Acceptance.**
- The tab header, the artwork footer mark and the app icon show the same drop-and-peak mark.
- All existing template tests still pass (the mark must not cause overflow or enter the safe margins).
- A new test asserts the brand mark SVG contains the peak path and is absent when `show.brand` is false.
- Screenshot of each template with the new mark in `docs/screenshots/m1/`.

**Note, 2026-11-13 (M1 partly done).**
- Done: one shared peak path (`PEAK_PATH` in `src/art/svg.ts`) drawn by both `Mark` and `brandMark`. On artwork the peak takes the background colour (opaque) or near-black (transparent), with a contrast fallback. In-app the peak uses the `accentInk` token so it shows in both themes. Two new tests (16 total): peak present with `show.brand`, absent without, zero overflow, contrast of at least 3 for every swatch. `app.json` has `backgroundColor` and a splash background of `#101412`.
- Verified: typecheck, `npm test` 16/16, e2e, header mark in dark and light at three widths, the daily recap export by eye. Template screenshots in `docs/screenshots/m1/`.
- **Not done: the app icon.** `assets/icon.png`, `assets/favicon.png` and the Android icon layers are the stock Expo placeholder (blue chevron), not the mint drop this section describes. The approved logo file is not in the repository. The peak was therefore drawn from the written description and has not been compared with the real logo. `android.adaptiveIcon.backgroundColor` was left at `#E6F4FE` because the foreground is not the mint drop. Needs the owner: supply the logo files, or approve generating the icon set from the in-app mark.
- Skipped: step 4 (name), which waits for D1.

**Note, 2026-11-13, later (icon set generated).** The owner chose to generate the icons from the in-app mark. `node tools/make-icons.cjs .` renders `icon.png` (1024), `favicon.png` (48), `android-icon-foreground.png` (512, mark inside the adaptive safe zone), `android-icon-background.png` (flat `#101412`), `android-icon-monochrome.png` (432, peak cut out of the drop) and `splash-icon.png` (1024, transparent) from the same drop and peak paths. `android.adaptiveIcon.backgroundColor` is now `#101412` and the splash entry points at `splash-icon.png`. Verified: `icon.png` and `favicon.png` by eye; transparency of the three transparent files by pixel count; `npx expo config` accepts the config. Not verified: how the icon, adaptive icon mask, themed (monochrome) icon and splash look on a real phone (M7). The mark has still never been compared with the owner's original logo file, which is not in the repository.

---

## M2. Split `src/screens.tsx`

**Goal.** Make parallel work possible. No behaviour or visual change.

**Target layout.**

```
src/
  screens/
    home.tsx          Home
    post-detail.tsx   PostDetail
    glucose.tsx       Glucose
    create.tsx        Create
    explore.tsx       Explore
    profile.tsx       Profile
    settings.tsx      Settings
    import.tsx        ImportScreen
  components/
    page.tsx          Page
    post-card.tsx     PostCard
    glucose-chart.tsx the SVG trace from Glucose (with areaPath)
  hooks/
    use-readings.ts   useReadings
```

**Steps.**
1. Move code verbatim. Keep names. File names are kebab-case.
2. Update the re-exports in `app/` to the new paths.
3. Delete `src/screens.tsx` when nothing imports it.
4. Do not move anything into `app/`; routes stay thin.

**Acceptance.**
- Typecheck, tests and e2e pass with no test changes other than import paths.
- Screens look identical to `docs/screenshots/baseline/`.
- `docs/PROJECT_MAP.md` updated with the new paths.

**Note, 2026-11-13 (M2 done).**
- `src/screens.tsx` deleted; 8 screens in `src/screens/`, `Page`, `PostCard` and `GlucoseChart` in `src/components/`, `useReadings` in `src/hooks/`. Not verbatim: `export` added to `useReadings` and `PostCard`; the chart `<Svg>` block became `GlucoseChart` with props, and `useColors()` moved into it.
- Verified: typecheck clean, `npm test` 16/16, e2e passing, 8 routes with no console errors. Pixel comparison of 48 fresh screenshots against `docs/screenshots/baseline/`: Settings, Import and Post detail identical; Home, Explore and Profile differ only in the 14 by 8 px header mark (the M1 peak line); My Glucose and Create also differ in their data areas because the synthetic readings follow the clock, so those two were checked by eye, not pixel for pixel.

---

## M3. One data layer

**Goal.** One way to compute statistics, one reading conversion point, a parser that handles real Dexcom Clarity exports, and unit and range settings that apply everywhere.

**Files.** `src/analytics.ts`, `src/art/analytics.ts`, `src/csv.ts`, `src/story.ts`, `src/types.ts`, `src/store.tsx`, `src/screens/glucose.tsx`, `src/screens/create.tsx`, `src/screens/import.tsx`, `src/screens/settings.tsx`, `tests/core.test.ts`, `tools/test.cjs`. Reference: `prototypes/share-first-web/src/csv.ts` and `prototypes/share-first-web/tests/csv.test.ts`.

**Specification.**
1. **Statistics.** `src/art/analytics.ts` becomes the only implementation. Rewrite `summarize` and `segments` in `src/analytics.ts` as thin wrappers that convert `Reading {timestamp}` to engine readings and call `computeStats` and `segmentsFor`. Keep the existing return shape so screens do not change. Rules that must hold: forward step capped at 5 minutes, last reading counts 5 minutes, time in range uses observed time as the denominator, coverage is reported separately, gaps over 10 minutes break the line, valid range 20–600 mg/dL, duplicate timestamps keep the last row.
2. **Wall-clock conversion.** Exactly one function converts app timestamps to engine time (currently `wall()` in `src/story.ts`). Move it to `src/analytics.ts`, export it, and use it in both wrappers.
3. **CSV.** Port the prototype parser into `src/csv.ts`, keeping the existing `parseCsv` export name or updating its two callers. Required behaviour: find the header row after any preamble; use the "Timestamp" and "Glucose Value" columns; when an "Event Type" column exists use only `EGV` rows; read the unit from the header and ask the person when it is missing, never guess; map "Low" to 40 and "High" to 400 mg/dL and flag them; warn on ambiguous day/month order; list rejected rows with line numbers (cap 20); never keep patient info, device ids or the file name. Port the prototype's CSV tests into `tests/` and add each new source file to `tools/test.cjs`.
4. **Settings.** Add `range: {low: number; high: number}` (mg/dL, default 70 and 180) to `State` in `src/types.ts` with a safe default when loading older saved state. My Glucose reads and writes it. Create passes `state.unit` and `state.range` into `StoryOptions` on every render, not only at first mount.
5. **Samples.** Replace `samples/synthetic-clarity.csv` with a fuller synthetic Clarity-shaped file generated by `prototypes/share-first-web/scripts/make-sample-csv.ts` (fictional patient rows included so tests prove they are dropped).

**Acceptance.**
- One statistics implementation; a test proves My Glucose and Create give the same time in range and average for the same day.
- The sample Clarity file imports; the on-screen numbers match an independent calculation in a test; the strings "Sample", "Person" and the device id never appear in app state.
- Changing the unit or range in Settings changes the Create preview without restarting.
- Old saved state (without `range`) still loads.
- Tests: at least 25 passing.

**Note, 2026-11-13 (M3 done).**
- Statistics: `src/art/analytics.ts` is the only implementation. `summarize` and `segments` in `src/analytics.ts` are wrappers with the same return shapes; `wall()` and `toEngine()` live there and `src/story.ts` imports them. Behaviour changes on My Glucose: the line now breaks at gaps over 10 minutes (was 7.5), and day bounds are wall-clock, as Create already did.
- CSV: `parseCsv(text, options)` in `src/csv.ts` is the prototype parser, returning a result object instead of throwing. Unit comes from the header; when missing the result has `needsUnit` and Import asks. Low and High map to 40 and 400 and are counted. Rejected rows are listed with line numbers (cap 20). Kept from the old parser: date order choice (now with auto-detect) and an optional UTC offset; an empty offset means the device time zone, and an offset written inside a timestamp is honoured. AM/PM timestamps are now accepted.
- Settings: `State.range` (mg/dL) with `loadState` and validation in the new `src/state.ts`. My Glucose and Settings share `src/components/range-inputs.tsx`. Create derives unit and range from the store on every render.
- Sample: `samples/synthetic-clarity.csv` regenerated by the prototype script: 3870 EGV rows over 14 days, fictional patient rows, device id `SYNTH-0001`, interleaved insulin rows. It has no Low or High rows; those are covered by unit tests only.
- Verified: typecheck clean; `npm test` 45/45 (9 statistics, 17 CSV, 5 settings, 14 earlier); e2e passing; 48 route screenshots with no console errors; My Glucose and Import checked by eye at 375 px. Agents also checked in a browser that the sample imports with 0 rejected rows and that saved state contains none of "Sample", "Person", `SYNTH-0001` or the file name; that a unit and range change in Settings shows in Create without a reload; and that old saved state without `range` loads.
- Not verified: the Import missing-unit prompt, Low/High line and rejected-row list on screen (parser tests only); a real Clarity export (M9); daylight-saving days; anything on a device.
- Test tooling: `tools/test.cjs` now discovers source and test files itself. `E2E_BASE_URL` points the Playwright journey at an already-running server on another port, and `BASE_URL` does the same for `tools/screenshots.mjs`. Reason: a dev server left running for a day served compressed bundles very slowly (about 10 s per page load), which timed the journey out; a fresh server ran it in under 5 s.

---

## M4. Share-first first run, flags, local telemetry

**Goal.** A new person reaches a good default graphic in under 30 seconds and at most three primary actions: choose data, pick a template (a default is already shown), export.

**Files.** New `src/flags.ts` (port from `prototypes/share-first-web/src/flags.ts`), `src/art/telemetry.ts`, `src/screens/home.tsx`, `src/screens/create.tsx`, `src/screens/import.tsx`, `src/store.tsx`, `app/(tabs)/_layout.tsx`, new `app/welcome.tsx` and `src/screens/welcome.tsx`. Reference wording: `prototypes/share-first-web/index.html` and `src/app.ts`.

**Specification.**
1. **Welcome screen** at `/welcome`, shown on first launch (a `seenWelcome` boolean in `State`). Headline from `BRAND.tagline`. Three actions: "Try demo data" (primary), "Import Dexcom Clarity CSV", "Make a milestone graphic (no data)". One line of privacy copy: the file is read on this device, nothing is uploaded, the file name is not kept. Each action lands on Create with a graphic already showing.
2. **Flags.** `isEnabled(name)` with defaults: `shareFirstMvp` and `localCsvImport` on; `eventLogging`, `accounts`, `dexcomApi`, `appleHealth`, `glucoseTimeline`, `communityFeed`, `clubs`, `activities`, `wrapped`, `vizGallery` off. Overrides come from `EXPO_PUBLIC_FLAGS` (comma-separated names). Decide with the owner (D4) whether the fictional feed, Explore and clubs stay visible in the default build or sit behind `communityFeed` and `clubs`; label them clearly as a demo either way.
3. **Telemetry.** Wire the existing events: `app_opened`, `demo_started`, `import_started` / `import_succeeded` / `import_failed`, `template_selected`, `customization_opened`, `export_started` / `export_succeeded` / `export_failed`, `share_sheet_opened`, `feedback_submitted`. Mode is `off` by default and `local` when `EXPO_PUBLIC_TELEMETRY=local`. There is no remote mode. In local mode, Settings shows a "Local analytics" panel with event counts.
4. **Remove imported data.** A clearly labelled button in Settings and on Import that clears `state.imported` at once and confirms it.
5. **Share wording.** After a native share, say the share sheet was opened and that Gluca cannot see what was chosen. Never say "posted" or "shared to".

**Acceptance.**
- Fresh install: welcome, one tap, graphic visible. Measure and record the time in the roadmap note.
- A test proves the telemetry payloads contain only the allowed enum values and that off mode records nothing.
- A test proves flag parsing ignores unknown names.
- Flagged-off features are not reachable by navigation.
- E2E journey extended: welcome, demo, export.

**Note, 2026-11-13 (M4 done).**
- Welcome: `/welcome` on first launch (`seenWelcome` in state; saved state from before this field counts as seen). Three actions land on Create with a graphic, or on Import and then Create. Settings has "Show welcome screen". Measured in the e2e journey on the dev build: 237 ms from welcome visible to graphic visible, one tap.
- Flags: `src/flags.ts`, configured once in `app/_layout.tsx` from `EXPO_PUBLIC_FLAGS`. Per D4, `communityFeed` and `clubs` default on. `src/nav.ts` decides which tabs, links and routes exist; `src/components/guard.tsx` redirects a flagged-off route to `/create`. `communityFeed` gates the Home tab, post detail and publishing from Create; Explore stays while `communityFeed` or `clubs` is on; `localCsvImport` gates Import and every link to it.
- Telemetry: `src/telemetry.ts` wraps the closed spec. Off unless `EXPO_PUBLIC_TELEMETRY=local`; no remote mode. Wired: `app_opened`, `demo_started`, `import_started` / `_succeeded` / `_failed`, `template_selected`, `customization_opened`, `export_started` / `_succeeded` / `_failed`, `share_sheet_opened`. Not wired: `feedback_submitted`, because there is no feedback UI. Settings shows a "Local analytics" panel in local mode.
- Remove imported data: button in Settings and on Import, shown only when imported readings exist; clears at once and confirms in words.
- Share wording was already correct and was left alone.
- Verified: typecheck clean; `npm test` 64/64; extended e2e journey passing (welcome, demo, export, then the earlier steps); web export; 54 route screenshots (9 routes) with no console errors. A separate build with `communityFeed=false,clubs=false,localCsvImport=false` and local telemetry was checked in a browser: tabs are My Glucose, Create and Profile; `/`, `/explore`, `/import` and `/post/seed-0` redirect to `/create`; the welcome import action and the publish-to-feed UI are absent; the Local analytics panel appears; no console errors.
- Not verified: the event counts shown in the Local analytics panel against the actions taken (payload shape is unit-tested); the redirect timing on native; anything on a device.
- Known nit: with the community flags off, the page header still shows the "Fictional community" pill. Logged as problem 26.

---

## M5. Create screen polish

**Goal.** The Create screen feels finished and native and web exports match.

**Files.** `src/screens/create.tsx`, `src/story.ts`, `src/export.ts`, `src/ui.tsx`, `app/_layout.tsx`, new files under `src/components/`.

**Specification.**
1. **Template picker.** Replace the text buttons with a horizontal strip of thumbnails rendered from the real engine (small `SvgXml` of each template with the current data), with the label beneath. Selected state is a border plus a check, not colour alone.
2. **Date.** Replace the typed date with previous and next day buttons and a native date picker limited to days that have data. Check the Expo SDK 58 docs for the current recommended picker before adding a dependency, and record the choice in `docs/DECISIONS.md`.
3. **Fonts.** Load Inter with `expo-font` at app start so native preview and native export use the same face as web exports. Then `nativeSafe()` can keep `font-family`. Measure text on native with the same approximate measurer the tests use and confirm no overflow on a real phone.
4. **Glow.** Leave the blur filter out on native, or emulate it with a wider low-opacity stroke under the trace. Do not ship a filter that `react-native-svg` ignores.
5. **Photo background** for the transparent overlay template: pick a photo from the library with `expo-image-picker`, show the trace over it in the preview, export the composite. The photo never leaves the device and is not saved in state.
6. **Customize** as a bottom sheet with sections: Words, Numbers, Elements, Look. Colour swatches show a selected ring and have accessible names.
7. **Contents list** stays visible near the export button on every screen size.
8. **Export states.** Disabled while exporting, a clear success line, a clear failure line with what to try.

**Acceptance.**
- Every template × format exports at the exact size on web (e2e) and matches the preview.
- Text never overflows with a 90-character headline and a 140-character caption (existing overflow tests still pass).
- Works with the screen reader: each control announces its name and state.
- Screenshots in `docs/screenshots/m5/`.

**Done 2026-11-13.** Create was split into `src/components/create/` (artwork-preview, photo-background, template-strip, day-picker, export-panel, customize, publish-card); state stays in `src/screens/create.tsx`.
- Verified on web (Edge, dev server): type-check clean; 88 unit tests; e2e journey passes; all 18 template × format exports are the exact size (scripted check, not part of the e2e); a photo-background export at 1080×1920 has the photo's corner pixels; 375 / 430 / 1280, dark and light, no horizontal scroll and no console errors; screenshots in `docs/screenshots/m5/`.
- Engine: week artwork gets week wording for default headlines (problem 21); range labels sit in a right gutter clear of the trace, tested for every template, format and period (problem 22); native-safe SVG maps each weight to an Inter family and replaces the blur glow with two soft strokes.
- Not verified: anything on a phone: Inter on Android per weight, the glow emulation, the image picker and its permission, the photo composite through `captureRef`, the Modal sheet, text overflow on a device. Screen-reader behaviour was checked by roles, names and states in the accessibility tree, not with VoiceOver or TalkBack. Photo export checked in Story format only (crop maths unit-tested for all three). Previous / next day buttons and disabled thumbnails were not clicked through.
- Known gap: with "7 days" selected the image says "Another week…" while the Headline box in Customize still shows the day wording. My Glucose still has a typed date field.

---

## M6. Design pass on the remaining screens

**Goal.** Home, Post detail, My Glucose, Explore, Profile, Settings and Import look designed, in the same language as Create. Independent of M5.

**Files.** `src/screens/*.tsx` except `create.tsx`, `src/components/*`, `src/ui.tsx`.

**Specification.**
- Use only tokens and primitives from `src/ui.tsx`. Add a primitive there when a pattern repeats three times.
- **Home:** post cards with avatar, name, relative time (add `createdAt` to seeded posts), title, caption, optional snapshot as a compact stat row, and kudos / comment / save actions as icon buttons with labels for screen readers. An empty state and a "you're all caught up" end state.
- **My Glucose:** the latest reading as a hero figure, range chips, the chart with time labels on the x axis and range labels, the stat tiles, and a short plain-language note on what the percentages mean.
- **Explore:** people and clubs as cards with avatars; follow and join as toggle buttons with clear state.
- **Profile:** header with avatar and name, the person's own posts, links to Settings and Import.
- **Settings:** grouped rows (Appearance, Units and range, Privacy, Data). Destructive actions need a confirmation.
- **Import:** three clear steps (choose file, review preview and warnings, confirm). Show rejected rows plainly.
- Every screen: loading, empty and error states; dark and light; 375 px with no horizontal scroll; 44 px touch targets.
- Keep the "Local demo" and "Fictional community" labels visible wherever fictional content appears.

**Acceptance.** Screenshots of every screen and state at 375, 430 and 1280 px in `docs/screenshots/m6/`; e2e passing; no hardcoded colours in screens (search for `#` in `src/screens/`).

**Done 2026-11-13.** New primitives in `src/ui.tsx`: `Icon`, `IconButton`, `Chip`, `Section`, `Group`, `ListRow`, `SwitchRow`, `Notice`, `EmptyState`, `Steps`, `Sheet`, `ConfirmSheet`, and a `heading` size on `T`. `Page` takes a subtitle, is 720 px wide at most, and shows "Fictional community" only while a community flag is on (problem 26).
- Verified on web: 54 screenshots (9 routes × 375 / 430 / 1280 × dark / light) in `docs/screenshots/m6/` with no console errors; e2e passing (button names updated for the new post card and My Glucose); no hardcoded colours in `src/screens/` (the only literals in `src/components/` are the black / white check on accent swatches); Import driven once with `samples/synthetic-clarity.csv` through review, confirm and remove.
- Posts have `createdAt` and relative times; My Glucose chart axis is fitted to the data and target band (problem 23); destructive actions ask first.
- Not verified: empty, loading and error states were built but mostly not looked at (Home empty, My Glucose empty and error, Import missing-unit, ambiguous-date and failure states, post not found at 1280); Follow / Join toggles and the post "More options" sheet were not clicked; nothing on a phone. D3 (dark or light default) is still the owner's decision.

---

## M7. Real-device verification

**Goal.** Know what works on real phones, and fix what does not.

**Steps.** Follow `README.md` "Try it on your phone". Test on at least one iPhone and one Android phone: web in the phone browser first, then Expo Go or a development build.

**Checklist to record in `docs/DEVICE_TESTS.md`** (device, OS version, browser or build, date, result):
- App opens; every tab renders; safe areas correct on a notched phone.
- Create: preview correct; each format exports; the saved image is the exact pixel size; transparent PNG keeps its alpha.
- Share sheet opens with the image attached; saving to the photo library works after the permission prompt and fails gracefully when refused.
- The exported story looks right inside Instagram and one other app; safe margins hold; note what each app does with transparency.
- CSV import through the document picker.
- Text size set to large in the OS: nothing clips.
- Screen reader pass through Create.

**Acceptance.** `docs/DEVICE_TESTS.md` filled in; every failure either fixed or listed in `docs/PROJECT_MAP.md` known problems.

**Prepared 2026-11-14.** `docs/DEVICE_TESTS.md` holds the checklist with every result blank. Nothing has been run on a phone. A development build uses an Expo account and the paid EAS service, so it needs the owner's approval first; so does a cloud simulator.

---

## M8. Event logging on the trace (behind `eventLogging`)

**Goal.** Let a person mark meals and activity after the fact and show them as small icons on the trace, for their own graphic.

**Reference mockups.** `docs/design/events_story.png`, `docs/design/meal_card_post.png`, `docs/design/log_sheet_wheels_mockup.png`.

**Files.** `src/types.ts`, `src/store.tsx`, new `src/events.ts`, new `app/log.tsx` and `src/screens/log.tsx`, `app/_layout.tsx`, `src/art/svg.ts`, `src/art/templates.ts`, `src/screens/create.tsx`.

**Specification.**
- Data: `GlucaEvent {id, kind: "meal" | "activity" | "note", start: number, durationMin: number, label?: string}`, stored locally. No carbohydrate counts, insulin amounts or doses, now or later, without a clinical and legal review.
- Entry: a slide-up form sheet (Expo Router `presentation: "formSheet"`, with `sheetGrabberVisible` and `sheetAllowedDetents`). Kind chips, a start-time wheel and a duration wheel, and a live strip of the glucose trace showing where the event will sit. The owner prefers iOS-style wheels. `@expo/ui`'s date picker had no countdown mode when last checked; verify current docs and choose between it, a community spinner picker, or a custom wheel, and record the choice.
- Artwork: original icons (fork-and-knife, running figure, note) on the trace at the event time, with a duration bar for activity. Icons are listed in "What's on this image" and can be switched off.
- Copy never links an event to a "good" or "bad" outcome.

**Acceptance.** Flag off: no trace of the feature. Flag on: add, edit and delete an event; it appears on the chart and on at least the daily recap and real-side templates without overflow; tests cover placement and the contents list.

**Done 2026-11-14 (web only).** `src/events.ts` (validation, add / update / remove, window filter), `/log` form-sheet route (`src/screens/log.tsx`, custom `src/components/wheel.tsx`), a "Logged" list and entry button on My Glucose, and event icons in the artwork engine (every template except milestone; icons only, labels are never drawn on the image).
- Verified with `EXPO_PUBLIC_FLAGS=eventLogging=true` in Edge: add an activity, it is listed on My Glucose, the Create contents list shows "Logged events: 1 activity (icons only, no text)", edit it into a meal, delete it after the confirmation; no console errors. Screenshots in `docs/screenshots/m8/`.
- Verified with the flag off: no entry point on My Glucose, no switch in Customize, `/log` lands on Create; 54 screenshots with no console errors; e2e passes; 109 unit tests (placement, overlap, clipped duration bar, contents wording, output identical with no events).
- Not verified: the form sheet's detents and grabber on iOS and Android (on web `/log` is a full page); dragging the wheel by hand (buttons and screen-reader actions were used); week-period artwork with events was rendered but not looked at; events on templates other than daily recap and real side were not looked at. The feature's code is in the bundle when the flag is off; it is hidden, not removed.

---

## M9. Validation with real people and copy review

**Goal.** Find out whether people want this, before building a backend. See `docs/product/VALIDATION_PLAN.md`.

**Steps.**
1. Clinical or diabetes-educator review of every line in `src/art/copy.ts`, especially the educational tone. Record the reviewer and date in `docs/DECISIONS.md`.
2. Run the 8 to 12 sessions in the validation plan on participants' own phones. Never collect their files.
3. Test at least five real Clarity exports with the participants' consent, on their devices; turn each parsing failure into a synthetic test case.
4. Write up results in `docs/product/VALIDATION_RESULTS.md` and apply the decision rule in the plan.

**Acceptance.** Results written; a go, iterate or stop decision recorded by the owner.

---

## M10. Backend, accounts, integrations, release

**Blocked until the owner approves** real data, paid services and deployment. Read `docs/INTEGRATIONS.md` first. Outline only:

1. Supabase project, schema migrations, row-level security with cross-user denial tests for every table; raw readings and private media stored separately from posts; only an approved immutable snapshot attaches to a post.
2. Auth and adult onboarding; account export and deletion; encrypted local storage for real health data.
3. Real feed, follows, clubs, blocking, reporting with moderation.
4. Dexcom official API with server-held tokens and sandbox first; Apple Health and Health Connect after a policy review.
5. Privacy policy, terms, store listings, EAS build and submit, staged rollout.
6. Trademark clearance complete before any public listing.

Each item needs its own specification written into this file before work starts.

---

## M11 to M15. Identity, Boosts, achievements, Dexcom (owner's brief of 2026-11-16)

The full specification is the owner's brief of 2026-11-16. M12, M13 and M14 are independent of each other after M11. Health-outcome achievements stay behind `healthAchievements` (off) until a qualified clinical review; Dexcom is sandbox only.

**M11 done 2026-11-16.** Data model in `src/domain/` (`profile.ts`, `reactions.ts`, `achievements.ts`), new `State` fields with sanitising on load, kudos converted to Boosts in saved state, five new flags (all off), backend architecture recorded in `docs/DECISIONS.md`, Dexcom V3 facts in `docs/DEXCOM_INTEGRATION.md`.
- Verified: type-check clean; 121 unit tests (12 new: migration, privacy defaults, reaction toggling, partial dates, award sanitising).
- Not verified: nothing on screen changed, so no screenshots. In the Dexcom notes about 14 facts are marked NOT VERIFIED, including the developer terms on public sharing, PKCE, redirect URI rules and the dataRange response schema.

---

## Backlog (unscheduled)

- Year-in-review "Wrapped" with no rankings (`wrapped` flag).
- Recipe book: community meals with photos; needs moderation and a no-medical-claims policy.
- More templates: workout card, Dia-versary variants, weekly recap.
- DST-correct day boundaries in `src/art/analytics.ts`.
- Localisation and right-to-left layout.
- Motion: subtle trace draw-in on the preview.
