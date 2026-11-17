# Stage 3 — authenticated, transient Dexcom glucose retrieval

**Stage 4 follow-up:** explicit sandbox source selection in Create and real PNG export are now implemented and verified. [Stage 4 report](DEXCOM_SANDBOX_TEST_RESULTS.md) supersedes historical Create/Story Studio deferrals below. In-memory privacy handling, OAuth ownership and development gates remain in force.

**Live sandbox follow-up, 16 November 2026:** local credentials and an authorized connection are now configured. A backend-only read-only probe reached the official sandbox: dataRange returned HTTP 200; EGV query timestamps ending in `Z` returned 400, while the same UTC timestamps without a zone suffix returned 200 with **277 readings, all normalized successfully**, from **2026-11-15 20:35:02.692 UTC through 2026-11-16 19:35:02.164 UTC**. The corrected actual Stage 3 provider/normalizer also retrieved all 277 records with the database opened read-only. These are official simulated sandbox records, not the earlier mocked preview. The transport now serializes query timestamps in Dexcom's zone-less UTC format, retaining milliseconds. Typecheck and **297 automated tests passed** after adding the regression test. Current runtime needs the updated backend loaded; normal dashboard/Create remain demo/CSV by Stage 3 scope. Initial missing-configuration notes below are historical.

**Browser confirmation after restart:** the authenticated viewer at `http://localhost:3000/dexcom-data` successfully retrieved and displayed **277 official sandbox records**, with zero rejected/duplicate/out-of-period records. Selected interval: **2026-11-15 20:40:02.234 UTC to 2026-11-16 20:40:02.234 UTC**, end exclusive; most recent returned sample **2026-11-16 19:40:02.619 UTC**. The one-hour mobile delay explains why the latest returned sample can precede the advertised range end. Screenshot: `docs/screenshots/stage3/official-sandbox-verified.jpg`. The backend restart is complete; the earlier restart-needed note describes the update procedure. No dashboard or Story Studio source changes were made.

Implemented 16 November 2026 in the existing Expo application and Node backend. No new dependencies, background synchronization, dashboard/Story Studio integration or social features. Creative presentation remains a Claude handoff note in the viewer; existing design primitives are reused.

## Current architecture and inspected prerequisites

Expo Router entry `app/_layout.tsx` uses React Native, TanStack Query and the demo AsyncStorage store. Existing `src/providers.ts` supplies the unchanged Mock/Csv provider contract. `src/analytics.ts` adapts the shared pure `src/art/analytics.ts` engine; charts use `src/components/glucose-chart.tsx`. Normal dashboard and Story Studio still use demo/CSV. Stage 3 deliberately does not change `use-readings.ts` or persist readings through the demo store.

The existing Node HTTP backend, authenticated Gluca accounts, scrypt passwords, signed HttpOnly cookie sessions, owner-scoped SQLite queries, session-bound single-use OAuth state and AES-GCM token storage are reused. SQLite is backend-only, has no RLS, and relies on application authorization and OS file permissions; it is not a production identity service. Legacy EGV tables and unmounted ingestion modules remain in place for compatibility but receive no Stage 3 writes. No new health-data database was introduced.

## Verified official protocol

Checked the [official endpoint overview](https://developer.dexcom.com/docs/dexcomv3/endpoint-overview), [dataRange reference](https://developer.dexcom.com/docs/swaggerv3/other/getdatarangev3), and [EGV reference](https://developer.dexcom.com/docs/swaggerv3/other/getestimatedglucosevaluesv3) on 16 November 2026.

- Sandbox host is `https://sandbox-api.dexcom.com`; bearer authorization stays server-side. Only `GET /v3/users/self/dataRange` and `GET /v3/users/self/egvs` are allowed by this relay.
- EGV queries use UTC ISO timestamps, inclusive `startDate`, exclusive `endDate`, milliseconds supported, maximum 30 days. Device `systemTime` represents UTC but may drift; `displayTime` is device-local. Zone-less system timestamps are interpreted as UTC, explicit offsets respected. Both source strings are preserved.
- Published quota: 60,000 calls/app/hour, excess returns 429. This implementation additionally limits each route/IP and each server process to 1,000 data calls/hour, honors Retry-After, and performs no automatic data retries beyond one token-refresh recovery. A public multi-instance deployment needs a shared app quota.
- EGV envelope is `recordType: egv`, `recordVersion: 3.0`, `userId`, `records`; dataRange has nullable `egvs` with start/end timestamps. The subject is validated privately across both responses and not returned to the browser.
- EGV units explicitly include mg/dL, mmol/L and unknown; known mmol/L is converted with 18.0182. Unknown units and null measurements are rejected. Low/high limit markers 39/401 remain bounded estimates, explicitly disclosed in summaries; no missing measurement is invented.

The sandbox is simulated and does not grant real-user G7 data. Production hosts are refused. Mobile data availability has published delays (US one hour, elsewhere three hours), so this is not a live CGM display.

## Flow and privacy

1. Create/sign in to a Gluca sandbox account in Settings, then complete the existing official sandbox OAuth flow. Callback does not fetch glucose.
2. Viewer manually requests authenticated `GET /api/dexcom/data-range`. The backend uses only that account's encrypted connection and returns UTC history bounds plus a connection revision.
3. The provider chooses the latest available historical 1, 7 or 30 days, never today's date. It sends `POST /api/dexcom/egvs` with `{start,end,connectionRevision}` (UTC epoch milliseconds). POST requires the existing CSRF header and allowed origin.
4. Backend rechecks available history, intersects the requested interval, refreshes tokens if necessary, requests EGVs, validates the envelope and subject, normalizes records, checks connection/session again, and returns a no-store response. 30-day requests are bounded to 20,000 records / 8 MiB. This is a safety ceiling, not Dexcom pagination.
5. `DexcomGlucoseProvider` implements the existing interface. Its in-memory result exposes range/count/rejection metadata. There are no Dexcom tokens in its interface. The browser receives authorized health readings only.

Every normalized sample contains UTC epoch milliseconds, canonical mg/dL, original value/unit, source system/display timestamps, stable record/source IDs, trend/rate/unit/status, available device platform/app/generation and ingestion time. Unneeded transmitter/account identifiers are omitted. Last valid occurrence per record ID wins, records sort by UTC; the common analytics engine additionally collapses identical instants. Invalid samples are counted and excluded, never filled. Unknown trend/device metadata becomes null. Original timestamps preserve normalization evidence.

Raw readings exist transiently in backend request memory and viewer memory only. No glucose SQL inserts, localStorage/AsyncStorage, global query cache, telemetry, publishing, disk export, or permanent cloud history. Server logs contain method/path/status/duration only; upstream bodies and tokens are never logged or forwarded as errors. No-store responses do not prevent a user/browser extension from inspecting an authorized open page. Hiding the tab, leaving the viewer or pressing Clear aborts pending requests and clears its state; server checks also prevent late logout/disconnect responses from releasing data. A disconnected account in a different tab is detected on the next request; no background session polling is added.

UTC diagnostics use the same pure analytics implementation as CSV/mock, with an explicit UTC adapter so repeated daylight-saving hours remain distinct. Daily buckets start at UTC midnight; weekly buckets start Monday UTC. Range percentages use observed time; coverage uses the whole requested interval or full calendar bucket, so partial periods stay partial. Samples cover at most five minutes and gaps remain gaps. Existing local-time dashboard/art behavior is preserved.

## Windows setup and first request

Use the existing project, Node 22.13+ / 24.3+ / 26+ and installed dependencies. See [OAuth setup](OAUTH_SETUP.md) for existing key generation, session/account behavior and Windows ACL guidance. Preserve a populated `.env` and encryption key.

```powershell
Set-Location 'C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca'
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
```

Enter credentials in `.env` locally, never in chat or `EXPO_PUBLIC_*`. Set these backend values:

```dotenv
DEXCOM_CLIENT_ID=<local developer application id>
DEXCOM_CLIENT_SECRET=<local developer application secret>
DEXCOM_REDIRECT_URI=http://localhost:3000/api/dexcom/callback
DEXCOM_API_BASE_URL=https://sandbox-api.dexcom.com
DEXCOM_ENVIRONMENT=sandbox
APP_BASE_URL=http://localhost:3000
BACKEND_PORT=3000
TOKEN_ENCRYPTION_KEY=<32 random bytes, base64>
SESSION_SECRET=<at least 32 random characters>
DATABASE_PATH=server/data/gluca.sqlite
SERVE_WEB=true
ENABLE_DEXCOM_DIAGNOSTICS=true
NODE_ENV=development
```

The exact local callback to register is **`http://localhost:3000/api/dexcom/callback`**, if accepted by the portal. If HTTPS is required, run an approved tunnel to port 3000 (for example an installed `ngrok http 3000`), use its **actual assigned HTTPS origin** for APP_BASE_URL, and register **that same origin + `/api/dexcom/callback`** as DEXCOM_REDIRECT_URI. Restart backend and use the tunnel origin for the entire browser session. No tunnel address is assumed; no tunnel or deployment was created here. A tunnel exposes a development account service, so limit access and stop it after testing.

```powershell
npm run dexcom:check
$env:EXPO_PUBLIC_FLAGS = 'dexcomApi,dexcomDiagnostics'
npx expo export --platform web --dev --max-workers 2
npm run server
```

The `--dev` export is necessary: diagnostics are disabled in production bundles even if flags are set. Backend also requires the explicit diagnostics switch and refuses NODE_ENV=production. Keep this build local; public hosting must use a production export, NODE_ENV=production and ENABLE_DEXCOM_DIAGNOSTICS=false. Production data endpoints/UI need a separately reviewed feature in a later stage. No native OAuth handoff or native local health repository is added here.

1. Open `http://localhost:3000/settings` (or the actual configured tunnel origin); finish the existing Welcome flow if shown.
2. Create/sign in to a Gluca sandbox account. Connect Dexcom and choose a simulated user on the official `sandbox-api.dexcom.com` authorization screen. Return to Connected status. Never enter your Dexcom password in Gluca.
3. Open **Dexcom development data viewer** from Settings, select a period, then **Refresh Data**. Direct local route: `http://localhost:3000/dexcom-data`.
4. Inspect available bounds, retrieved period, latest timestamp, count, UTC chart and shared statistics. Empty history is valid. Keep demo/CSV for the ordinary dashboard.
5. To establish provenance, run the ordinary backend with configured credentials, not `server/testkit.ts` or a mocked fetch. The browser sees only same-origin relay calls; the backend's allowlist fixes upstream to official sandbox endpoints. A successful 200 response, sandbox label and actual history/count demonstrate the authorized path. A mocked test/preview is **not** proof of a live Dexcom request. Do not log bodies/tokens to establish provenance.

## Verification and remaining limits

```powershell
npm run typecheck
npm test
npm run dexcom:check
```

Readiness check is read-only and reports public callback/credential-presence booleans/connection count, never token values or individual readings. It does not itself authorize or contact Dexcom.

At implementation inspection this checkout had **no `.env`, no client credentials, no database and zero authorized connections**. Therefore no live OAuth authorization or sandbox EGV request could be executed; live date range/count are **unavailable**, not zero. Configure the values and consent above to finish external verification. Portal localhost acceptance and production account permissions remain unverified.

Synthetic tests cover schema/value/unit validation, stable IDs, duplicates, missing/invalid measurements, historical limits, UTC/offset/DST handling, session/owner isolation, CSRF, disconnect/logout races, refresh and revoked tokens, API failures/rate limiting, and common analytics. The synthetic relay fixture returns **two normalized readings on 2025-01-01, 00:00–00:05 UTC**; this count/range is mocked evidence only. No personal data fixture is committed.

Final evidence: **295 automated tests passed, zero failures**, and `npm run typecheck` passed. The opt-in development web export succeeded. Playwright's Edge launch was blocked by the environment (`spawn EPERM`); computer-use browser verification instead exercised an isolated in-memory backend with **288 synthetic readings, 2025-01-01 00:00–23:55 UTC**. The chart, shared statistics, partial calendar coverage and Clear control were checked at **375 / 430 / 1280 px in light and dark**, with no horizontal overflow. Screenshots are under `docs/screenshots/stage3/`; they show synthetic preview data, not an official sandbox response. The temporary preview was stopped and its memory database discarded. Native devices remain untested.

Deferred: persistent encrypted browser/native storage, opt-in encrypted cloud sync, automatic/background synchronization, incremental cursors, production access/identity/recovery/operations, dashboard/Story Studio adoption, clinical interpretation, achievements and social sharing. Stage 3 stops here.

## Files for Stage 3

- Backend: `server/config.ts`, `http.ts`, `routes.ts`, `static.ts`, `dexcom/client.ts`, `dexcom/normalize.ts`, new `dexcom/relay.ts`.
- Shared/provider: `src/types.ts`, `providers.ts`, `analytics.ts`, new `glucose-window.ts`, `glucose-periods.ts`, `services/dexcom-data.ts`.
- Viewer: new `app/dexcom-data.tsx`, `src/screens/dexcom-data.tsx`; minimal links/copy in `src/screens/settings.tsx`, `src/components/dexcom-connection.tsx`, `src/flags.ts`.
- Verification/config: new `tests/dexcom-data.test.ts`, `tools/dexcom-check.cjs`; existing provider expectation in `tests/core.test.ts`; `package.json`, `.env.example`, `app.json`. Web async route loading is disabled because dev split chunks evaluate code dynamically; synchronous routes preserve the existing strict CSP without unsafe-eval. No dependency added.
- Documentation: this guide, integration/implementation-plan/README, AGENTS, PROJECT_MAP, ROADMAP and DECISIONS updates.
