# Stage 7A — overlay composition and persistent navigation

Verified in the existing Gluca project on 17 November 2026. Focused fixes only; existing Stage 6B working-tree changes were preserved. No application rebuild, account/data migration, new feature system or visual redesign.

## 1. Photograph covered the transparent overlay

**Reproduced before editing.** On Create, selected synthetic data → Transparent overlay → Add a photo. The chart/text remained in the SVG and accessibility label, but the photograph visually covered it. DOM evidence: the React Native Image wrapper was absolutely positioned with z-index 0, while the SVG sibling was static with z-index auto. CSS paints positioned content over that unpositioned sibling even though the SVG occurs later in the DOM. Template selection, glucose data and the upload handler were not the cause of this disappearance.

**Fix:** keep the photo as an explicit background at z-index 0 and put the SVG into a positioned foreground wrapper at z-index 1. The existing SVG retains the glucose visualization, statistics/captions and decorative painter order. No templates or calculations were duplicated or rewritten. One `storyComposition()` policy decides whether a photo is active for both preview/native capture and web export. The capture surface is square-cornered to agree with the rectangular PNG canvas; the surrounding preview frame is unchanged. Web export already painted photograph first and SVG second, so its renderer was retained.

Editor settings and photo remain separate state. Adding/replacing/removing a photo does not set template or chart settings. A cached photo is retained when switching to a solid template, hidden there, and reused when switching back to transparent. The account-scope reset now compares its previous scope before clearing; React Activity may resume effects without a scope change, and that must not clear a photo merely because a screen became visible again. Actual account changes still clear the photo/result/day selection.

## 2. Navigation disappeared on detail routes

**Reproduced before editing.** Create had a bottom bar; direct `/profile-edit` had none. The bar was owned by `app/(tabs)/_layout.tsx`, while Profile editing, Settings, onboarding, post details and other workflows are siblings in the root Stack. They leave the tab layout entirely. This was a route hierarchy issue, not a random z-index or breakpoint failure.

**Fix:** one `ApplicationShell` wraps the root Stack and owns the persistent primary navigation. The original icons, labels and colour tokens are reused. The child Tabs navigator still owns its existing screens but renders no second bar. Screen content gets the remaining flex height and scrolls above the bar, rather than hiding under an absolute overlay. The shell follows the browser visual viewport during resize/keyboard pan and uses native safe-area insets plus browser safe-area padding.

The shell selects existing navigator keys with the same targeted NAVIGATE action as Expo's built-in tab bar and pops only the sibling detail routes above the existing tabs. Runtime investigation confirmed that SDK 58 wraps the application stack in a synthetic `__root` navigator, so target discovery traverses that wrapper. Resolving a fresh URL/tab group from a detail screen could otherwise reset the editor. The selected template and SVG were verified unchanged after Create → Profile → Edit profile → Create.

The same-origin static host also omitted `/account` from its SPA allowlist, producing an actual JSON 404 for direct account links. Added that specific exported route; project files, secrets and arbitrary paths remain blocked. Existing static security tests cover the allowlist.

Intentional exceptions:

- `/account`: authentication entry, with a shared visible Close action returning to Create.
- `/welcome`: first-run entry, with Close marking the welcome as seen and returning to Create.
- Existing sheets/system workflows (Customize, date picker, confirmations, native log form sheet, photo picker/share sheet): their existing Close/Done/Cancel controls dismiss them. They may temporarily cover or capture input over the shell. The embedded story editor/preview itself is not a bar-hiding exception.

The requested Today/Community/Insights workflows correspond to this repository's existing Home/Explore/My Glucose routes; names were preserved.

## Verification evidence

**Automated core:** `npm test` passed **360/360**, zero failures/skips; TypeScript passed. Coverage includes composition policy and stacking, photo replacement/removal/settings invariance, template switching, transparent SVG format geometry, navigation visibility/selection, existing navigator targets (including SDK's wrapper), PNG evidence helpers and existing OAuth/sync/profile/social tests. Test compilation now includes shared test helpers while still executing only `tests/*.test.ts`.

**Actual browser:** reproduced both original failures and checked corrected behavior. Confirmed overlay over added photo, replaced photo, removed photo, switching templates and returning. Verified 21 route/viewport/scroll combinations across Home, Explore, Create, My Glucose, Profile, Profile editing and post details at **375, 430 and 1280px**, with five visible tabs and a correctly selected section. Also checked actual tab transitions, detail-screen exits, a focused input with a 375×430 viewport simulating keyboard shrink, authentication Close behavior, and dark navigation at all three widths. Final route preservation check kept the selected transparent Square template and identical SVG through Profile editing. The final additional photo-through-detail-navigation recheck was interrupted by browser automation timeout; it is included in the new Playwright regression, not reported as a completed browser pass. During that prolonged interruption the existing private-cache lease expired, which intentionally invalidates account-scoped artifacts.

**Actual downloaded PNGs, inspected independently of UI success text:**

| Export | Dimensions | Fully transparent pixels | Visible white artwork pixels |
|---|---|---:|---:|
| Story with opaque synthetic photo A | 1080×1920 | 0 | 73,843 |
| Portrait after removing photo | 1080×1350 | 1,041,224 | 48,867 |
| Square with replacement synthetic photo B | 1080×1080 | 0 | 34,538 |

The PNG decoder checks signature, dimensions, IDAT data and actual RGB(A) pixels. Photo fixtures are generated opaque solid colours; the visible white trace/text is therefore foreground artwork. Outputs remain in ignored `.dexcom-verification/stage7a-*.png`. Before/after browser screenshots use synthetic data only and are under `docs/screenshots/stage7a/`.

**Browser regression suite added:** `tests/e2e/stage7a.spec.ts` exercises the preview pixels, actual exports/alpha/dimensions, add/replace/remove/template switching, photo persistence across a detail route, the shared navigation matrix and authentication Close. The runner was attempted but the environment denied spawning its worker with `EPERM`; it did not run to a passing completion here. Direct browser checks above are separate evidence. Physical iOS/Android safe-area/keyboard/native capture behavior remains unverified; desktop viewport shrink is not a phone keyboard test. No new dependency, deployment or analytics sink was added.

## Repeat commands (PowerShell)

```powershell
cd 'C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca'
npm run typecheck
npm test
$env:EXPO_PUBLIC_FLAGS='identity,accounts,dexcomApi,dexcomDiagnostics,dexcomSync'
npx expo export --platform web --dev
npm run server
```

In another ordinary PowerShell window, where Playwright can launch its worker/browser:

```powershell
$env:E2E_BASE_URL='http://localhost:3000'
npx playwright test tests/e2e/stage7a.spec.ts --workers=1
```

The browser test uses an isolated browser context, fictional local state and generated photo fixtures; it disables Dexcom fetching within that test context. Existing API/authentication, synchronization, onboarding, profile and shield code paths remain in place. No raw health history, tokens or private profile fixtures were added to the repository. Stage 7A stops here.

## Stage 7A files

- `src/components/create/artwork-preview.tsx`, `src/story-composition.ts`, `src/screens/create.tsx`: explicit composition and scope-aware photo reset.
- `src/components/application-shell.tsx`, `primary-nav-icons.tsx`, `src/nav.ts`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`: one persistent shell, original icons and state-preserving navigation.
- `server/static.ts`, `tests/server-static.test.ts`: account deep-link fallback and security regression.
- `tests/story-composition.test.ts`, `application-shell.test.ts`, `png-proof.test.ts`, `tests/e2e/png-proof.ts`, `stage7a.spec.ts`, `tools/test.cjs`: unit/browser regressions and shared-helper compilation.
- This report, project entry/map/roadmap/decision notes and synthetic screenshots: evidence and handoff.
