# Stage 7C — UI/UX audit

17 November 2026. Existing project, Stage 7B baseline clean. No rebuild of the application, feature migration, new service, dependency or health-data analytics. The findings table was created before application edits; completed implementation/verification follows below.

## Prioritized findings (before implementation)

| Problem | Screen/component | User impact | Severity | Recommended fix | Complexity |
| --- | --- | --- | --- | --- | --- |
| Selected canvas consumes touch scrolling, while Done positioning is below a tall Story preview | Create / overlay interaction | Exiting positioning is awkward on a short phone viewport | High | Tap again or Escape to finish; do not deselect after drag/pinch | Small/medium |
| Shared Modal supplies a dialog but no descriptive accessible name; footer safe-area treatment is identity-specific | Shared Sheet | Dialog purpose is harder to identify; native footer protection inconsistent | Medium | Name existing Modal and centralize footer inset; keep existing focus trap and Escape handling | Small |
| Photo picker has no pending indicator/concurrency guard or unmount guard | Story photo background | Repeated taps and late picker completions can overwrite a newer editing context | Medium | Busy/disabled controls and ignore results from a closed/replaced picker context | Small/medium |
| Forced weekly encouragement and old manual-viewer wording remain | Explore, Dexcom connection, comment empty state | Product voice is inconsistent; connection guidance is stale | Medium | Concise descriptive copy; preserve all saved posts/captions | Small |
| Selected-period filtering repeats during every overlay drag render | Create | Avoidable O(history) work during direct manipulation | Low/medium | Memoize the existing slice by data/start/end; keep calculations unchanged | Small |
| Dense source/safety header and long editor control stack | Shared Page / Create | Preview and primary action sit below the initial fold | Medium | Stage 8: validate progressive disclosure without hiding provenance/consent | Medium/large |
| Full-resolution photos are retained in memory | Story photo pipeline | Large camera images can increase decode/memory cost | Medium | Stage 8: bounded local resize with orientation/alpha/device QA | Medium |
| User's Today/Insights terminology differs from current routes | Existing five tabs | Discoverability could be clearer | Medium | Validate information architecture before renaming/replacing destinations | Medium/large |
| Physical keyboards, safe areas, screen readers and large text remain unverified | Native/browser-on-phone | Desktop viewport simulation is insufficient | Medium | Stage 8 device/accessibility matrix | External device testing |
| Independent elements, snapping and edge resizing | Future editor | More precise composition may be useful | Enhancement | Keep grouped drag/corner resize/pinch; defer advanced editing | Large |

Chosen scope: the first five findings only. Existing tabs, shield designs, glucose math, OAuth/synchronization, profile database and social systems remain intact.

## Baseline inspection and rendered review

Expo Router/React Native shared shell; `src/ui.tsx` tokens/primitives; `Page`; existing SVG artwork/native capture/web canvas export; protected Node/SQLite OAuth backend. Frontend credential handling remains through the protected server. Existing local-first cache/sync remains unchanged.

Rendered baseline: Home/community feed, My Glucose/dashboard and its period statistics, Create, Explore/community directory, Profile, onboarding, Edit profile, Settings & privacy/Dexcom connection, Account, identity gallery/shield designs and post conversation. **66 route/viewport/theme captures**: 375/430/1280px × light/dark × 11 routes. No document horizontal overflow observed. Normal routes retain navigation; Account has Close. Fonts resolve to the existing system sans-serif stack. My Glucose contains period insights; there are no separate Today/Insights routes to invent. Gallery preserves Stage 7B shields/emblems.

Browser tests run against the existing local server on port 3000 using isolated contexts, synthetic glucose, fictional profiles and fake OAuth fixtures where needed. No owner credentials or private profile are used in screenshots. Baseline screenshots/observations: `docs/screenshots/stage7c/before-*`. Initial immediate Escape observation is not treated as a defect: React Native Web already implements Escape and focus trapping; verification must wait for closing animation.

## Implementation and verification

Exactly five application improvements:

1. **Leave overlay positioning without reaching below the preview.** Tap a selected overlay again or press Escape. A movement threshold keeps drag/resize/pinch gestures from being mistaken for taps. Native PanResponder distinguishes a stationary single tap from a multi-touch gesture. Existing normalized transforms, bounds, handles, charts, background layer and export renderer remain. Browser regressions verify selection ends without altering composition and that navigation remains usable.
2. **Consistent shared sheets.** Label the existing Modal with its title and move footer safe-area inset handling into `Sheet`. Remove the identity-only duplicate padding. Keep the SDK's existing focus trap, Escape and Android close behavior; no second modal system was added. A named Customize dialog, editable headline, Escape close and visible Done are verified at 375×500. This simulates a short keyboard-sized viewport, not a real phone keyboard.
3. **Reliable photo-picker lifecycle.** Show “Opening photos…”, disable repeat picker/removal actions while pending, and ignore completions after that component unmounts. Key the photo control to the existing account/session version. A regression holds a chooser open, switches template, completes selection and verifies the stale photo is not attached when returning. Successful add/replace/remove/photo-backed exports still pass existing tests. No photo is uploaded or permanently stored; large-image reduction remains deferred.
4. **Concise static copy.** Explore now says “Discover people and communities.” Empty conversations say “Add a comment to this conversation.” Dexcom authorization copy distinguishes a sandbox connection from the device selected in a profile, replacing obsolete manual-viewer wording. No saved post, caption, profile, diagnosis or user-authored text is rewritten.
5. **Avoid repeated history slicing during direct manipulation.** Memoize the existing selected-period filter by data/start/end. This removes avoidable O(history) work from unrelated drag/opacity/UI renders without changing the range logic or analytics. No measured frame-rate, memory or export-speed improvement is claimed.

### Files modified

- `src/screens/create.tsx` — selection toggle, account-scoped photo-control key and memoized selected-period rows.
- `src/components/create/overlay-interaction.web.tsx`, `overlay-interaction.tsx`, `overlay-controls.tsx` — tap/Escape exit and gesture distinction/help.
- `src/components/create/photo-background.tsx` — pending/disabled state and stale-result guard.
- `src/ui.tsx`, `src/components/identity/identity-sheet.tsx` — named shared Modal and single footer safe-area policy. Stage 7B shield/emblem artwork is unchanged.
- `src/screens/explore.tsx`, `src/screens/post-detail.tsx`, `src/components/dexcom-connection.tsx` — static copy only.
- New `tests/e2e/stage7c.spec.ts`; existing `tests/e2e/dexcom-create.spec.ts` corrected to use its ephemeral server's actual origin and explicit manual-provider flags. `tests/e2e/dexcom-oauth.spec.ts` also sets its own flags, waits for actual refresh completion instead of an already-visible Connected label, and scrolls the Connected panel into its screenshots. This is fixture maintenance, not a sixth application change. The old fabricated Origin could prevent assets loading; automatic-sync flags also made older fixtures depend on the exported environment. Production security/origin checks are unchanged.
- Documentation: this report, UI_REFINEMENT, STORY_EDITOR, PROJECT_MAP, ROADMAP, DECISIONS, README and current-stage note in AGENTS. Synthetic evidence: `docs/screenshots/stage7c/`.

### Actual checks and results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | 368 pass, zero failures/skips |
| Normal browser suite against existing local server | 16 pass (2.1 minutes): existing journey, navigation, layering, overlay drag/handles/pinch/sliders, photo add/replace/remove, PNG dimensions/alpha, onboarding/date precision/privacy/shields/emblems plus four Stage 7C cases |
| Additional auxiliary-route/insights review | 1 pass: existing Import, Welcome, optional Log/Medals, development data viewer and period-statistics panels at 375/1280px in both themes; flags enabled only inside isolated test contexts |
| Isolated mocked Dexcom OAuth journey | 1 pass: simulated consent, session isolation, token rotation and responsive connection controls |
| Isolated mocked Dexcom → Create → PNG | 1 pass: 288 synthetic historical readings, normalized analytics/preview, mandatory simulation label and real 1080×1920 PNG export |
| Final pending-photo and short-sheet evidence | 2 targeted repeat checks pass |
| Development web export | Completed, strict CSP retained |
| Installed Prettier checks / `git diff --check` | Pass on scoped files; legacy compact `ui.tsx` formatting retained to avoid unrelated churn |
| ESLint | Not configured: no lint script/config/dependency. Formatting/TypeScript checks ran; no ESLint pass is claimed |
| Live Dexcom authorization / official sandbox request | Not repeated in this UI audit. The external journeys above are **mocked**, not new live sandbox evidence |

The checks above cover **19 distinct browser cases across full and targeted runs** (16 normal regression cases, one added auxiliary review and two isolated mocked journeys); repeat capture checks are not counted again. The default process sandbox blocks Playwright workers; checks ran with approved process permissions. Mock backends are ephemeral in-memory instances of the existing server, not new deployed services. Source credential/token/storage paths are unchanged. No secrets, raw real glucose, private profile or third-party tracking were added to evidence.

Before and after captures cover the same 66 core route/viewport/theme combinations, with **zero document horizontal-overflow cases**. Additional after-only auxiliary captures cover the five remaining existing routes and period-insights panels (24 captures). Optional logging/medals/diagnostics were inspected through development-test flags, not enabled in the application's production/default configuration. Together this covers all 16 existing screen routes. Representative visual review included mobile My Glucose/period statistics, Create, onboarding, Edit profile, connection/account forms, Explore, desktop profile, the short Customize sheet, pending photo controls, import, logging, medals and diagnostics; the Stage 7B suite also captures all shield/emblem styles, details, fictional comment authors and member/following rows. Primary navigation stays present on ordinary routes; Account/Welcome retain Close. Existing scrolling, resize, focused-input and nested-route regressions remain green. No physical safe-area, screen-reader, native pinch or OS keyboard pass is claimed.

Representative evidence: [short named sheet](screenshots/stage7c/sheet-375-short.png), [pending photo](screenshots/stage7c/photo-pending.png), [Explore before](screenshots/stage7c/before-explore-375-dark.png), [Explore after](screenshots/stage7c/after-explore-375-dark.png), [dashboard](screenshots/stage7c/after-glucose-430-dark.png), [period insights](screenshots/stage7c/period-insights-375-light.png), [connection settings](screenshots/stage7c/after-settings-375-light.png), [mocked Connected panel](screenshots/stage7c/dexcom-connection-375-light.png). JSON observations contain only route/layout/font metadata, not health data. Regenerated older-stage screenshots were preserved at their initial committed bytes; current evidence is kept under Stage 7C.

### Performance and editor scope

Existing artwork memoization, incremental foreground sync, concurrency prevention, refresh/backoff and ephemeral web glucose history are retained. No polling service, extra health-data request or analytics hook was added. Existing Story/Portrait/Square and transparent/photo-backed exports were exercised. The main workflow still uses source/template → photo → optional positioning/customization → explicit export; tap counts vary with date/source/customization and no reduced-tap claim is made. Header/provenance density, long settings forms, full-resolution photo decode and production-build size remain opportunities for Stage 8 measurement. Independent chart/stat editing, snapping and edge resizing are documented future work, not newly implemented features.

### Physical-device follow-up checklist

- [ ] iPhone notch/home indicator and Android gesture-navigation insets on sheets and bottom navigation.
- [ ] Real OS keyboard opening/closing, focused fields, modal scrolling and return focus in Safari/Chrome/native builds.
- [ ] VoiceOver/TalkBack dialog titles, trapped focus, badge explanations, switch hit areas and 200% text sizing.
- [ ] Native single-tap exit versus drag/pinch, screen resume, photo permission denial/cancel and account change while a picker is open.
- [ ] Large, rotated/HEIC/alpha photos, export memory, native PNG alpha and share/save behavior.

These remain limitations, not failed or passed browser tests. Existing production authentication/recovery, native OAuth handoff and encrypted native-cache device validation remain release gates from earlier stages.

### Repeat on Windows

Reuse the current backend environment and server on `http://localhost:3000`; no restart or new credentials are required for these source-only UI changes. Rebuild the existing development export and refresh the browser:

```powershell
cd 'C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca'
$env:EXPO_PUBLIC_FLAGS='identity,accounts,dexcomApi,dexcomDiagnostics,dexcomSync'
npx expo export --platform web --dev --max-workers 2
# Separate window, only if the existing backend is not already running:
npm run server
```

```powershell
npm run typecheck
npm test
$env:E2E_BASE_URL='http://localhost:3000'
npm run test:e2e -- --workers=1
npx playwright test --config playwright.oauth.config.ts
npm run test:dexcom:create
```

Do not set `STAGE7C_BEFORE` for normal regression runs; before evidence was captured from the original Stage 7B build.

## Stage 8 priorities (recommendations only)

1. Physical iOS/Android/Safari/Chrome keyboard, safe-area, large-text and screen-reader verification.
2. Measure large-photo decode/export memory and design a bounded, local-only image pipeline with orientation/alpha tests.
3. Test source/period controls and progressive disclosure with real users; preserve explicit sandbox/demo labels, incomplete-data notes and export consent.
4. Validate Today/Community/Create/Insights/Profile terminology against the existing Home/My Glucose/Create/Explore/Profile structure.
5. Consider snapping/independent element transforms only after those usability checks. Production auth/recovery/TLS/privacy gates remain separate release requirements.

Stop after Stage 7C; no Stage 8 work is authorized by this audit.
