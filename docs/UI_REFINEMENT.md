# Stage 7A.5 — focused UI refinement

17 November 2026. Existing project only. No dependency, backend, OAuth, sync/cache, glucose calculation, social system, profile schema or migration change. Working Stage 7A layering/navigation reused. Creative ornaments/redesign remain deferred to Claude.

## Implementation

Fixed-size cause: `ArtworkPreview` rendered the template SVG at the full format aspect ratio, with no transform model, editable gesture layer or sizing controls. Photo state was already separate after Stage 7A. Added a normalized group transform without changing templates' chart/data calculations. Shared SVG composition drives preview and export. Handles/matte stay outside captured artwork. Pinned simulation disclosure remains visible at all positions/opacities. Existing original solid templates remain untransformed; stored photo/layout return in transparent mode.

Details: [STORY_EDITOR.md](STORY_EDITOR.md). Copy decisions and replaced phrases: [GLUCA_VOICE_AND_TONE.md](GLUCA_VOICE_AND_TONE.md).

## Files

New code: `src/overlay-transform.ts`; `src/components/create/overlay-controls.tsx`, `overlay-interaction.tsx`, `overlay-interaction.web.tsx`, `editor-slider.tsx`, `editor-slider.web.tsx`.

Modified code: `src/screens/create.tsx`; `src/components/create/artwork-preview.tsx`, `customize.tsx`; `src/story.ts`; `src/art/copy.ts`, `model.ts`, `templates.ts`; `src/screens/onboarding-flow.tsx`; existing copy only in `src/achievements/challenges.ts`, `life.ts`.

Tests: new `tests/overlay-transform.test.ts`, `tests/e2e/stage7a5.spec.ts`; neutral default expectations in existing `tests/art-fonts.test.ts`. Documentation: this report, STORY_EDITOR, GLUCA_VOICE_AND_TONE, PROJECT_MAP, ROADMAP, DECISIONS, README and the current-stage note in AGENTS. Synthetic PNG/screenshot evidence is in `docs/screenshots/stage7a5/`.

## Verification

Core suite: **364 passed**, including existing Dexcom OAuth/refresh/ownership/sync/cache/analytics/profile tests. Type checking passes. Development web export succeeds using existing strict CSP. No live Dexcom request was required for this UI stage; browser exports use synthetic demo data. No claim of new live API verification.

**Final browser suite: 7 passed (59.0 seconds)** against the actual exported application, using Microsoft Edge. Existing journey and Stage 7A photo/navigation regressions pass. New coverage: drag, corner resize, sliders, arrows, reset; add/replace/remove photo; date/style/tab retention; all three exact export dimensions and transparent alpha; simulated touch pinch and unselected scroll policy; optional/custom/removed captions. The responsive matrix covers **375/430/1280px × light/dark**, with no horizontal document overflow and visible primary navigation. Four new browser tests are included in those seven. Targeted Prettier checks and `git diff --check` pass; legacy compact files keep their existing formatting to avoid unrelated churn.

Visually inspected the saved 375px light editor/controls and 1280px dark editor, plus the actual Story preview/export pair. The chart, labels, relative placement and opacity agree; the exported PNG omits selection outlines/handles. Also inspected Portrait/Square/transparent outputs and the remaining responsive screenshots. Preview uses native-compatible font/glow rendering while the web export embeds its font; small text rasterization/glow differences remain expected. These are synthetic fixture images, not private photos or health data. PNG parsing verifies exact dimensions and alpha; this is not a pixel-identical screenshot assertion.

The default sandbox blocks Playwright worker creation (`spawn EPERM`). Running the same tests with approved process permissions works. No service was deployed or application security policy weakened. No ESLint configuration exists; use TypeScript, tests, targeted Prettier and `git diff --check` rather than claiming an ESLint pass.

## Repeat on Windows

From the existing project directory:

```powershell
npm run typecheck
npm test
$env:EXPO_PUBLIC_FLAGS='identity,accounts,dexcomApi,dexcomDiagnostics,dexcomSync'
$env:EXPO_NO_TELEMETRY='1'
$env:EXPO_OFFLINE='1'
npx expo export --platform web --dev --max-workers 2
npm run server  # separate PowerShell window; reuse your existing backend environment
```

With the backend running on its existing `http://localhost:3000`:

```powershell
$env:E2E_BASE_URL='http://localhost:3000'
npm run test:e2e -- tests/e2e/stage7a5.spec.ts --workers=1
# Existing photo/navigation and journey regressions too:
npm run test:e2e -- --workers=1
```

Browser tests use isolated test contexts, synthetic photos/readings and explicit demo selection; they do not change the owner's account, private profile or historic posts. Native hardware, native capture alpha and screen readers remain unverified. Layout is in memory only; reload begins a new draft. Rotation, durable drafts and individual text/chart editing are not implemented. Stop after Stage 7A.5.
