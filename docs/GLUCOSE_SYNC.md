# Stage 5 — foreground Dexcom synchronization

Implemented in the existing Gluca application on 16 November 2026. This supersedes earlier stage descriptions of manual-only Dexcom retrieval. Scope is the development web sandbox; no public deployment, real personal glucose access, always-on polling or automatic publication.

## Strategy

One root `GlucoseDataProvider` owns one `GlucoseSync` and a provider-independent `GlucoseCache`. My Glucose and Create subscribe to the same normalized dataset. Session verification precedes private cache access. Already loaded data stays visible while foreground refresh runs.

Defaults, configurable through `SyncConfig` in `src/glucose-sync.ts`:

| Setting | Default |
|---|---|
| Fresh-cache threshold | 5 minutes |
| First fetch | Latest 7 UTC calendar dates bounded by actual dataRange |
| Incremental overlap | 24 hours before the last successful checkpoint |
| Rolling retention | 30 days, plus one explicitly selected older period |
| Preferred Create day | Latest completed UTC day with at least 70% coverage; otherwise explicitly reported partial data |

Checks run on open, supported AppState resume, browser visibility/focus and Sync Now. A fresh check verifies the session but skips range/EGV retrieval. There is no recurring polling timer. Simultaneous requests within one controller coalesce; historical requests serialize and reuse fetched intervals. Separate tabs have separate memory caches and may independently fetch; no distributed synchronization lock is claimed.

Ranges come from the official endpoint, independently of today's date. Queries never exceed 30 days; start is inclusive and end exclusive. UTC system timestamps are used, with zone-less ISO query parameters required by the live sandbox. Stable source IDs and timestamps deduplicate records; newer ingestion replaces corrected records, including moved timestamps. A bounded overlap captures delayed/corrected records within that horizon. Corrections older than the overlap, removed source records and arbitrary historical completeness are not guaranteed; the controller supports a forced selected-window refresh for future UI use.

429 respects Retry-After. Other transient failures back off exponentially from 30 seconds to 5 minutes. Sync Now respects backoff. A failed fetch/write does not advance the checkpoint. Existing encrypted backend refresh, rotation, owner checks and reconnect behavior are reused. Cached readings remain available through temporary failures only within the verified session lease.

## Storage and privacy controls

**Web:** `MemoryGlucoseCache` is ephemeral. No raw readings are written to IndexedDB, localStorage, AsyncStorage, query-cache persistence or the server. Navigation shares memory; page reload, app closure or logout clears it. Cold offline startup cannot restore history. During a temporary network outage an open app can use verified cached data until its lease expires (at most 15 minutes, also bounded by session expiry); then data is cleared until online session verification succeeds. Returning to the app automatically reverifies an expired lease; Sync Now also does so. Explicit deletion/disconnect remains paused and does not silently restart.

IndexedDB offers capacity and transactional storage, not protection from same-origin JavaScript/XSS, extensions, a shared browser profile, device compromise or eviction. Storing a decryption key alongside ciphertext does not solve those problems. No browser unlock/recovery/key-management scheme is established, so this stage deliberately uses ephemeral storage. See [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

**Native adapter:** `private-glucose-cache.native.ts` implements SQLCipher SQLite with a random 256-bit key held separately in Expo SecureStore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Only the key belongs in SecureStore; the glucose snapshot belongs in the encrypted database. SQLCipher support is checked before tables/data can be written, and missing cipher/key support fails closed. No plaintext fallback. `app.json` enables SQLCipher and disables Android backup. A custom native build is required; Expo Go's default SQLite is unsuitable. Native OAuth handoff and physical-device encryption/restore/background tests remain unimplemented/unverified, so automatic Dexcom sync stays web-only. See [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) and [SecureStore limits](https://docs.expo.dev/versions/latest/sdk/securestore/).

The adapter has atomic versioned writes/tombstones and namespace isolation. Backend status returns a non-authenticating HMAC cache namespace tied to the authenticated session and connection generation. A different session/connection cannot read the old namespace. Account changes, logout and disconnect cancel in-flight work, remove visible private readings and clear the active namespace before the server mutation. Metadata-only BroadcastChannel events invalidate other open tabs; browsers without this API rely on their bounded lease and next authoritative check. The browser's sessionStorage pause marker contains no user IDs or health data.

**Delete local glucose history** clears active cached history and pauses automatic sync until Sync Now or a new successful sign-in/connection check. **Disconnect Dexcom** also clears private session caches and removes backend tokens; it stops subsequent Dexcom retrieval. Deleting cache leaves authorization intact. Neither action deletes previously exported files or explicitly published snapshots. Logical deletion is not a claim of forensic erasure of OS memory, database journals, backups or screenshots.

CSV import/parser and demo providers remain available. Raw CSV readings now stay in session memory too. On first load, a legacy plaintext imported-history field is removed from the persisted demo state, with a notice to reimport; original CSV files, preferences and explicit posts are preserved. This intentional privacy migration replaces prior reload persistence. Raw private readings never enter the social store or achievements evaluator. Existing user-approved export files remain under the user's control.

## Dashboard and Create

Connected users automatically get Dexcom in My Glucose and Create. The status card shows connection, last successful sync, newest cached and available timestamps, refresh/error/backoff state, and simulation/delay labels. Missing data stays missing. Existing UTC analytics and artwork calculations are reused; coverage is actual sampled time, never missing time counted in range. Dashboard percentages and artwork may round coverage differently (for example 100% versus 99% for nearly complete data).

Open Gluca → Create → existing Daily recap preview → Customize → Export. The default completed day is already loaded; no manual sync/source selection is required. Other historical dates can be selected and loaded. An edited-but-unloaded date cannot export the previous day's data under the new date. All sandbox exports retain mandatory simulation labeling. Source buttons still allow demo/CSV; selection is shared with the dashboard. Nothing publishes automatically.

## Windows launch and verification

From PowerShell:

```powershell
cd 'C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca'
npm install
# Configure backend-only .env using .env.example; never paste secrets into chat.
$env:EXPO_PUBLIC_FLAGS='dexcomApi,dexcomDiagnostics,dexcomSync'
npx expo export --platform web --dev
npm run server
```

Open `http://localhost:3000/settings`, sign into the existing Gluca sandbox account, and Connect Dexcom only if not already connected. Select the official simulated G7 sandbox user during consent. Then open My Glucose/Create. Use the same origin throughout. Existing configured callback: `http://localhost:3000/api/dexcom/callback`; if the portal requires HTTPS, follow [OAuth setup](OAUTH_SETUP.md) using the actual tunnel origin for both APP_BASE_URL and DEXCOM_REDIRECT_URI. No tunnel address is invented or service created. Restart the backend after server changes; rebuild `dist` after frontend/flag changes.

The flags are public feature switches, never credentials. Backend-only values remain DEXCOM_CLIENT_ID, DEXCOM_CLIENT_SECRET, DEXCOM_REDIRECT_URI, DEXCOM_API_BASE_URL, DEXCOM_ENVIRONMENT and existing session/vault secrets. Never change existing encryption keys casually: current stored tokens would become unreadable. No repeated consent is needed while the Gluca session and Dexcom connection remain valid.

```powershell
npm run typecheck
npm test
npm run test:dexcom:sync -- --username Conor
```

The last command makes actual official sandbox requests using an existing authorized backend connection. It prints aggregate counts/windows and HTTP statuses only; no tokens, individual readings or raw response bodies. Without configuration/session/consent it reports BLOCKED, not mocked success. CI unit tests use synthetic fixtures and mocked API replies. The local Codex execution environment blocks tsx child spawning; its verification used an in-process TypeScript loader running the same `server/index.ts`, not a second or mocked backend. Ordinary PowerShell uses `npm run server` above.

## Evidence and remaining gates

Stage 4 already established live G7 retrieval and a real 1080×1920 PNG export; see [Stage 4 results](DEXCOM_SANDBOX_TEST_RESULTS.md). Stage 5 live command returned HTTP 200 for dataRange/devices/EGVs, initial **1,678** readings and **1,678** after overlap, no duplicates. Initial window **2026-11-11T00:00:00.000Z → 2026-11-17T01:25:02.463Z**; incremental window **2026-11-16T01:25:02.463Z → 2026-11-17T01:25:02.463Z**. A fresh check made no EGV request. Create selected **2026-11-16** from the shared dataset; cache deletion was verified. These are real official simulated sandbox requests, not personal G7 data or mocked tests. Exact counts/timestamps change as sandbox data evolves.

Browser checks additionally verify automatic initial retrieval, shared Create preview and manual refresh at supported responsive sizes. Automated tests cover bounded initial/incremental/overlap, corrections/late arrivals, duplicates, concurrency, failure/backoff, lease/offline handling, restored cache, account/revision isolation, logout/disconnect/delete races, SQL adapter transactions, legacy plaintext removal, Create integration and existing token refresh/rotation. Native SQL tests use a synthetic SQLite test double with a simulated cipher capability; they prove transaction logic, **not real encryption**.

For public deployment: retain one protected backend (not static hosting alone), stable HTTPS callback/cookies, verified production identity/recovery, Dexcom production approval and terms review, restricted persistent token-vault volume/keys/backups, encrypted storage device verification, dependency advisory review, operational redaction, shared rate limits/refresh locks for multiple instances and a reviewed browser key-management policy if durable browser history is required. Opt-in encrypted cloud backup remains a future design with user-held key/recovery and separate health/social permissions; no upload path or cloud health database exists here. Creative polish is reserved for Claude; revisit status-card density only after functional/privacy checks, preserving delay/source labels and explicit export consent.

## Files changed in Stage 5

Final verification: **340/340 automated tests passed**, zero skipped/failed; `npm run typecheck` clean; development web export completed. Actual browser verified automatic open/reload, shared dashboard/Create state and manual incremental refresh at 375/430/1280 widths, light/dark, with no horizontal document overflow at measured sizes. Theme and viewport restored. Screenshot: ignored `.dexcom-verification/stage5-create.jpg`. Read-only database check confirmed **zero rows** in the dormant backend `egvs` table. No new consent, publication, deployment or account creation occurred. Stage 4's real PNG export evidence is reused; Stage 5 verified the updated preview rather than claiming another PNG export.

- `.env.example`
- `AGENTS.md`
- `app.json`
- `app/_layout.tsx`
- `docs/DECISIONS.md`
- `docs/DEXCOM_IMPLEMENTATION_PLAN.md`
- `docs/DEXCOM_SECURITY.md`
- `docs/GLUCOSE_SYNC.md`
- `docs/PROJECT_MAP.md`
- `docs/ROADMAP.md`
- `package-lock.json`
- `package.json`
- `README.md`
- `server/dexcom/status.ts`
- `server/dexcom/sync-verification.ts`
- `server/routes.ts`
- `src/components/dexcom-connection.tsx`
- `src/components/glucose-sync-status.tsx`
- `src/components/page.tsx`
- `src/encrypted-glucose-cache.ts`
- `src/flags.ts`
- `src/glucose-cache.ts`
- `src/glucose-context.tsx`
- `src/glucose-sync.ts`
- `src/hooks/use-create-readings.ts`
- `src/hooks/use-readings.ts`
- `src/private-glucose-cache.native.ts`
- `src/private-glucose-cache.ts`
- `src/private-persistence.ts`
- `src/screens/create.tsx`
- `src/screens/dexcom-data.tsx`
- `src/screens/glucose.tsx`
- `src/screens/import.tsx`
- `src/screens/settings.tsx`
- `src/services/dexcom-oauth.ts`
- `src/services/glucose-sync-transport.ts`
- `src/services/session-events.ts`
- `src/store.tsx`
- `tests/glucose-cache.test.ts`
- `tests/glucose-sync.test.ts`
- `tests/private-persistence.test.ts`
- `tests/server-cache-scope.test.ts`
- `tests/server-oauth.test.ts`
- `tests/session-events.test.ts`
- `tools/test-dexcom-sandbox.cjs`
