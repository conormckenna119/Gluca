# Roadmap and specifications

Root: `C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca`. Read `AGENTS.md` first.

Work the milestones in order unless a milestone says it is independent. Each one is sized for a single focused session. When you finish one, tick it here and add a dated note saying what you verified and what you did not.

| # | Milestone | Status | Depends on |
| --- | --- | --- | --- |
| M0 | Baseline: run it, fix what breaks, set up git | not started | none |
| M1 | Brand alignment: logo, icon config, name decision | not started | M0 |
| M2 | Split `src/screens.tsx` | not started | M0 |
| M3 | One data layer: analytics, CSV, units and range | not started | M2 |
| M4 | Share-first first run, flags, local telemetry | not started | M3 |
| M5 | Create screen polish | not started | M3 |
| M6 | Design pass on the remaining screens | not started | M2 |
| M7 | Real-device verification | not started | M5 |
| M8 | Event logging on the trace (flagged) | not started | M5 |
| M9 | Validation with real people and copy review | not started | M7 |
| M10 | Backend, accounts, integrations, release | needs owner approval | M9 |

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

## Backlog (unscheduled)

- Year-in-review "Wrapped" with no rankings (`wrapped` flag).
- Recipe book: community meals with photos; needs moderation and a no-medical-claims policy.
- More templates: workout card, Dia-versary variants, weekly recap.
- DST-correct day boundaries in `src/art/analytics.ts`.
- Localisation and right-to-left layout.
- Motion: subtle trace draw-in on the preview.
