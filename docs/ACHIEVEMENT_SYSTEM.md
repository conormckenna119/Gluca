# Stage 8B update - Community Challenges

The existing registry now drives five optional account-owned challenges with private enrollment and idempotent completion. Four associated medals are reused (First Post, First Activity, Awareness, Personal Milestone); Community Connection is a nonmedical definition for explicit outside-community membership plus meaningful-exchange confirmation. There is no second award repository. Challenge completion updates the existing encrypted cabinet within the same transaction, and only genuinely new award IDs enter the existing unlock queue. Session-scoped announcement deduplication handles concurrent reads/activity receipts; old loaded medals and completion replays remain silent.

Trophy Cabinet, pin limit/order, individual medal privacy and collection opt-in remain independent of always-private participation. Previous Personal moments/local prototype functions are retained without migrating old counters into enrollments. Existing medals may be associated with a newly completed challenge without a duplicate award or invented new award date. No health rules are enabled. See COMMUNITY_CHALLENGES.md for sources, conditions, tests and limits. Stop after Stage 8B.

# Stage 8A.5 update - 18 November 2026

The existing unlock host now reads authoritative repository awards rather than the lagging demo-state mirror, avoiding dropped feedback immediately after a genuine award. It shows the original medal, name, neutral description, View Achievement and Dismiss, with a subtle 180ms entrance and 140ms exit. Reduced motion uses a static popup. Feedback waits until the user leaves Create/onboarding/profile editing/authentication. Loading a collection on app launch never enqueues old medals. Feedback uses a reserved area above the existing navigation, so it cannot cover page controls. It expires after eight seconds where screen-reader detection permits; otherwise it stays dismissible. React Native Web conservatively reports screen-reader mode, so web notices remain available until dismissed. Diagnosis-anniversary and medical-derived notices remain silent to avoid exposing private medical identity; those medals remain available privately in the cabinet. No new medical awards.

First Post rule version 3 requires an actual public Gluca feed row owned by the account. The award is created atomically with the post in the existing encrypted repository; direct fake publication events are rejected. Private posts do not count as community publication. A lost response/retry cannot duplicate either the post or its award. Earlier version-2 local-demo medals are preserved and labelled as legacy local awards in details. Other life/community eligibility and shield calculations are unchanged. No automatic backlog awards.

Premium unlock motion is a documented future design task only: see FUTURE_UX_ENHANCEMENTS.md. Full publishing architecture, privacy and remaining native/social limits are in STORY_EDITOR.md. The former local-only First Post source descriptions below are historical and superseded by this section.

# Achievement system - Stage 8A

The existing registry, Medal SVG artwork, detail sheets, toast and Create milestone renderer are reused. No second achievement system/backend/dependency was added. `src/achievements/events.ts` separates explicit eligibility from UI. The old snapshot evaluator is no longer mounted; historical demo posts/counters/challenges do not grant account medals.

## Eligibility and event sources

The registry exposes ID, name, description, category, medal design (renderer/icon/category), eligibility, required data, repeatability, rule version, default privacy and feature flag.

| Medal                 | Qualifying source                                                                                          | Repeats |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| First Story           | Successful browser PNG export/download or native photo-library save; opening a share sheet is insufficient | Once    |
| First Post            | New non-private post explicitly published to the existing local demo feed                                  | Once    |
| First Activity        | New activity saved through the existing flagged Log                                                        | Once    |
| Community Boost       | Existing Boost or comment reported by the local UI                                                         | Once    |
| Dia-versary           | Complete, non-approximate private diagnosis date, on its anniversary day                                   | Yearly  |
| Awareness             | Explicit awareness-activity confirmation in Personal moments                                               | Once    |
| Personal Milestone    | Explicit voluntary milestone confirmation                                                                  | Once    |
| Community Contributor | Three distinct new local posts/comments                                                                    | Once    |

Community events are client-reported local prototype actions, not externally verified participation or moderated proof of helpfulness. User-confirmed activities are labelled. Supporters can earn relevant medals without Dexcom. The legacy Activity of your choice definition is retained for compatibility but not offered/awarded by this event path.

## Persistence and privacy

GET/POST /api/achievements reuse the existing authenticated HttpOnly sessions, CSRF Origin/custom-header checks, body limit and write rate limiting. Client-supplied owner, arbitrary awards, dates, glucose and timestamps are not trusted. Additive migration 6 adds a user_achievements row per owner with primary-key/foreign-key constraints. The award/receipt document uses existing AES-256-GCM encryption and owner-specific authenticated context. Missing encryption configuration fails closed.

BEGIN IMMEDIATE serializes read/modify/write, event deduplication and the three-pin limit across concurrent requests. Award identity remains user/achievement/period; yearly awards retain their year, rule version and opaque related event. Receipts stop accumulating when no longer needed for eligibility. No captions, raw activities, glucose, birthdays or diagnosis dates are copied into awards. No award-level plaintext SQL index is introduced: uniqueness is enforced inside the transactional encrypted owner document.

Account awards survive reload through the existing backend; browser copies are memory-only and excluded from AsyncStorage. Guest medals are explicitly session-only and never silently imported on sign-in. Legacy prototype awards stay preserved in their original local storage field, excluded from active collections and never uploaded. This old archive is not described as encrypted; new account medals do not enter it.

Account transitions clear active awards/details/toasts. Epoch checks discard stale responses and queued work; exports carry their initiating account scope. Provider disconnect does not erase life/community medals. Failed/offline writes report an error without pretending success; Reload collection recovers. No durable offline queue. Native accounts remain gated, so native collections are session-only.

## Windows development

From the existing Gluca project root, retain existing backend-only .env encryption/session/Dexcom settings. No additional key/service is required.

```powershell
$env:EXPO_PUBLIC_FLAGS='identity,accounts,achievements,dexcomApi,dexcomDiagnostics,dexcomSync'
$env:EXPO_NO_TELEMETRY='1'
$env:EXPO_OFFLINE='1'
npx expo export --platform web --dev --max-workers 2
npm run server
```

Restart the existing backend after updating rather than starting a duplicate on port 3000. Open http://localhost:3000/profile -> Trophy Cabinet, or /trophies. Keep healthAchievements off. Add eventLogging only to use the existing optional activity logger; its absence is not an award.

```powershell
npm run typecheck
npm test
$env:E2E_BASE_URL='http://localhost:3000'
npx playwright test tests/e2e/stage8a.spec.ts --workers 1
```

The cabinet browser test starts the same backend on a private temporary port with in-memory SQLite and a fictional account, uses synthetic glucose for a real PNG export, and confirms optional activities. No owner account, credentials or real health data is used. Native device verification, durable offline delivery, social-server verification/moderation and public production release remain future work. No live Dexcom request is necessary for these award rules.

## Verification - 2026-11-17

- TypeScript clean; 374 core tests pass, including transactional account API, private/public projection, encrypted persistence, duplicates, pin constraints/order, exact/leap/approximate anniversaries and stale-export account scope.
- 18 normal browser cases pass across the regression run and targeted retests. The only initial legacy failure expected the old Medals heading; its updated Trophy Cabinet assertion passes. The final cabinet case additionally verifies guest visibility controls.
- Two separate mocked Dexcom browser journeys pass: OAuth/session isolation/rotation, and historical data through Create to a real PNG. No live Dexcom request was made in this stage.
- Cabinet and detail sheets exercised at 375/430/1280px in both themes, with actual CSS theme assertions, no horizontal overflow, visible Close controls and emulated reduced motion. Twelve fictional screenshots retained; cabinet variants and mobile detail inspected visually. No physical native test claim.
- Development web export passes. No lint script/configuration exists in package.json; targeted Prettier check, TypeScript and git diff whitespace checks are used instead. No lint dependency was introduced.

## Modified files

- Backend: server/achievements.ts (new), server/db.ts (additive migration), server/routes.ts, server/profiles.ts.
- Domain/eligibility: src/achievements/events.ts (new), src/achievements/life.ts (rule version 2), src/achievements/registry.ts, src/domain/achievements.ts, src/domain/profile.ts.
- State/privacy: src/hooks/use-achievements.ts, src/private-persistence.ts, src/store.tsx.
- Existing event producers: src/screens/create.tsx, src/screens/log.tsx, src/screens/post-detail.tsx, src/components/create/publish-card.tsx, src/components/boost-button.tsx.
- Cabinet/profile: src/screens/trophies.tsx, src/screens/profile.tsx; existing achievement components challenge-list.tsx, medal-sheet.tsx, pinned-medals.tsx, unlock-toast.tsx. Original Medal artwork, identity shields and Story Studio renderer retained.
- Tests: tests/achievement-events.test.ts and tests/server-achievements.test.ts (new), tests/achievement-life.test.ts; tests/e2e/stage8a.spec.ts (new), tests/e2e/stage7c.spec.ts (heading expectation only).
- Docs: README.md, docs/ACHIEVEMENT_SYSTEM.md, docs/ACHIEVEMENT_SAFETY.md, docs/TROPHY_CABINET.md, docs/PROJECT_MAP.md, docs/ROADMAP.md, docs/DECISIONS.md; synthetic evidence docs/screenshots/stage8a. Historical screenshots regenerated by regressions were restored.

## Before public production

Complete existing production authentication/recovery/deletion and age/privacy policies, enforce HTTPS/secure cookies, restrict database and encryption-key permissions, establish encrypted backup/rotation/retention processes, and replace client-reported local-community events with trusted social-service receipts when that service exists. Add device and accessibility verification before native release. Design opt-in durable offline persistence separately. Keep all medical-outcome awards disabled pending qualified clinical review and separate authorization. Stage 8B was not started.
