# Stage 6B — account onboarding and profiles

This stage extends the existing application, registration, identity flag, profile model, date mathematics, SVG shields/emblems, privacy switches and fictional feed. It does not add another identity provider, community backend, achievements or reactions. The existing Node session/account system remains development-only; production recovery, verified identity and an explicit minimum-age policy are still release gates.

## Run and launch

In Windows PowerShell, from the existing project:

```powershell
cd 'C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca'
npm install
$env:EXPO_PUBLIC_FLAGS='identity,accounts,dexcomApi,dexcomDiagnostics,dexcomSync'
npx expo export --platform web --dev
npm run server
```

Use the existing backend-only `.env` configuration. No new secret is required: protected profiles reuse the server's AES-GCM vault key with a separate owner-bound encryption context. A missing key disables profile persistence instead of storing plaintext. Restart an already-running backend after this update so it loads the new routes/migration. Native account handoff/server-origin configuration remains unverified; use the same-origin browser workflow for account-owned profiles.

- Account: `http://localhost:3000/account`. Existing registration/login are preserved; registration offers onboarding after creating the account. Passphrases are distinct from Dexcom credentials.
- Onboarding: `http://localhost:3000/onboarding`, also **Profile → Set up your profile** for returning accounts without completed onboarding. Optional questions never block account creation.
- Editing: `http://localhost:3000/profile-edit`, **Profile → Edit profile**. Change values, then **Save profile and privacy**. Settings' existing privacy controls have the same explicit save action.
- Gallery: `http://localhost:3000/identity-preview`, all ten tiers, emblems and compact examples. Only the existing identity flag is needed for identity UI; keep account/Dexcom flags according to the workflow being tested. Other feature flags remain off.
- Saved public profile: **Profile → View saved public profile**, or `/profile?username=<chosen-public-handle>`. This read-only view uses the protected public projection endpoint. Unsaved/unknown handles show a clear not-found state; guests are asked to sign in.

## Flow

1. **Connection:** seven inclusive choices (Type 1, Type 2, another diabetes type, friend/family, caregiver, awareness, prefer not to say).
2. **Journey:** only for people who selected living with diabetes. Exact, month/year, year-only or skipped diagnosis. The live animated shield preview uses the existing conservative completed-years calculation. Public shield visibility is an explicit choice.
3. **Technology and interests:** optional monitoring and insulin-delivery sections expand only when requested. All requested CGM choices, Tandem/Omnipod/twiist/Medtronic, pens, syringes, other/none/prefer-not options are supported; pump/CGM model questions appear conditionally. Supporters instead get optional non-numeric emblems. Suggestions use the existing community catalogue; nobody is automatically joined. Device answers never authorize Dexcom.
4. **Profile:** live public preview, name, optional public handle/bio/photo, optional interests and birthday celebration. Birthday has month/day only. Account age confirmation is separate and is not verified by a birthday. Public medical fields remain off unless deliberately chosen.
5. **Welcome:** review and Finish setup, followed by a personalized confirmation and Explore/Profile actions. Living-with-diabetes users may optionally visit Settings to connect Dexcom. Supporters do not need a glucose account.

Every optional step can be skipped. Existing answers are retained unless explicitly cleared; switching role hides medical identity publicly without silently deleting the underlying private information. Editing invalid dates disables save/continue where supported and the server independently rejects invalid/future diagnosis dates. Empty dates produce no numeric shield. Unknown parts are never filled in.

## Persistence and existing data

Account profiles now live in an additive encrypted `user_profiles` table under existing authenticated owners. The social demo remains local and fictional; it is not a production multi-user social database. Public handles are independently chosen and unique, and do not rename the existing login credential. Concurrent edits use revisions and return a conflict rather than overwrite another session's changes.

New private profile changes stay out of device-wide AsyncStorage. Guest profile edits last in memory for the open app. Previous local profile/privacy fields remain preserved in the original saved demo state, without automatic upload or reassignment to an account. **Review previous local profile** explicitly loads that copy into an editable draft with public medical switches reset off; only a subsequent save uploads it to the current account. Original posts, preferences, migrations and Dexcom rows are preserved. See [PROFILE_PRIVACY.md](PROFILE_PRIVACY.md).

Profile photos are processed locally through Expo ImagePicker and ImageManipulator: square crop, 128×128 JPEG, bounded data URI. The original is never uploaded by this flow. A cropped photo enters the protected profile request only on explicit save and is a public profile field. No remote image URL or SVG upload is accepted. [Official Expo image manipulation reference](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/). Physical-device permissions/capture remain unverified.

## Verification

Run `npm run typecheck` and `npm test`. The suite includes synthetic account registration/login, missing onboarding, account isolation, encrypted persistence, CSRF, public projection, visibility opt-ins, username uniqueness, revision conflicts, malformed/future dates, key-unavailable behavior, date precision, leap years, existing tier boundaries and the unchanged Dexcom suite. The repository has no ESLint configuration; changed TypeScript/JSON files are checked using installed Prettier rather than claiming an ESLint run.

Browser evidence and final counts are recorded below after verification. No real diagnosis/birthday is used in fixtures. Browser draft checks do not overwrite the owner's account profile; persistent profile behavior is tested through actual local HTTP requests with fictional accounts and an in-memory test database. A live Dexcom test is separate from the mocked/synthetic suite.

Final automated verification: **351 tests passed, zero failed/skipped**, clean TypeScript check, changed TypeScript/JSON files passed Prettier checking, and development web export completed. The metadata-only cross-tab channel now distinguishes provider disconnect from account logout: both stop private glucose work, but a Dexcom disconnect leaves the account profile intact. Identity-only builds also receive account invalidation messages.

Browser verification on 16–17 November 2026 covered 375/430/1280px layouts across light/dark: living-with-diabetes and caregiver branches, year-only approximate shield preview, optional questions, cropped synthetic-image preview, live name/handle/bio preview, emblem explanation, shield gallery, profile/editor and privacy controls. Measured document widths had no horizontal overflow. The fictional Maple Example draft was not committed to the owner's account; the actual profile table remained empty and the backend glucose table remained at zero rows. Original light theme and viewport were restored, and a fresh onboarding start was left open. Screenshots are in `docs/screenshots/stage6/`. Positive profile persistence/public filtering were exercised through local HTTP tests with fictional accounts, not by overwriting the owner's profile. Physical native-device behavior, a browser save under a newly registered fictional session, and a positive remote-member screen with a saved real account remain unverified. No production services were deployed.

**Live Dexcom regression PASS:** `npm run test:dexcom:sync -- --username Conor` used the existing official G7 sandbox connection. Range/devices/EGV requests returned HTTP 200; initial and overlapping incremental sync retained **1,691 readings**, with no duplicates; fresh-cache check skipped EGV retrieval and Create used the shared dataset for **2026-11-16**. Initial window **2026-11-11T00:00:00.000Z → 2026-11-17T03:00:02.858Z**; overlap **2026-11-16T03:00:02.858Z → 2026-11-17T03:00:02.858Z**. These are official simulated sandbox data, separately verified from synthetic profile tests. No new consent or production glucose access was performed.

## Files changed in Stage 6B

- `.env.example`
- `AGENTS.md`
- `docs/DECISIONS.md`
- `docs/IDENTITY_SHIELDS.md`
- `docs/ONBOARDING.md`
- `docs/PROFILE_PRIVACY.md`
- `docs/PROJECT_MAP.md`
- `docs/ROADMAP.md`
- `docs/screenshots/stage6/onboarding-430-light.jpg`
- `docs/screenshots/stage6/profile-1280-light.jpg`
- `docs/screenshots/stage6/shields-375-dark.jpg`
- `package-lock.json`
- `package.json`
- `README.md`
- `server/db.ts`
- `server/profiles.ts`
- `server/routes.ts`
- `src/components/identity/name-line.tsx`
- `src/components/identity/partial-date-input.tsx`
- `src/components/identity/profile-fields.tsx`
- `src/components/identity/profile-save.tsx`
- `src/components/identity/question-fields.tsx`
- `src/components/identity/shield.tsx`
- `src/components/identity/user-identity.tsx`
- `src/components/post-card.tsx`
- `src/domain/onboarding.ts`
- `src/domain/profile-experience.ts`
- `src/domain/profile.ts`
- `src/domain/public-view.ts`
- `src/glucose-context.tsx`
- `src/private-persistence.ts`
- `src/screens/account.tsx`
- `src/screens/explore.tsx`
- `src/screens/identity-preview.tsx`
- `src/screens/onboarding-flow.tsx`
- `src/screens/onboarding.tsx`
- `src/screens/post-detail.tsx`
- `src/screens/profile-edit.tsx`
- `src/screens/profile.tsx`
- `src/screens/settings.tsx`
- `src/services/dexcom-oauth.ts`
- `src/services/profile.ts`
- `src/services/session-events.ts`
- `src/store.tsx`
- `tests/private-persistence.test.ts`
- `tests/profile-experience.test.ts`
- `tests/server-profiles.test.ts`
- `tests/session-events.test.ts`
