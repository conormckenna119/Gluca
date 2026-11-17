# Gluca — Dexcom integration implementation plan

## Stage 5 update — 16 November 2026

The owner's staged requests supersede the original proposed numbering below. Stage 4 live G7 sandbox/PNG verification succeeded. Stage 5 implements automatic foreground incremental sync and shared dashboard/Create cache within the existing application/backend. Full details: [GLUCOSE_SYNC.md](GLUCOSE_SYNC.md), [DEXCOM_SECURITY.md](DEXCOM_SECURITY.md).

Reused: official authenticated transient relay, backend encrypted OAuth vault/rotation, normalization, UTC analytics, chart/templates/PNG export and CSV/mock providers. Added: glucose-sync/cache/context modules, native SQLCipher adapter, shared status/privacy controls, session invalidation events and backend status helper. No second backend, permanent server glucose history or polling service.

Web uses ephemeral memory until a reviewed encryption/unlock/recovery design exists. Raw CSV history is also excluded from persisted demo state, including notice-based legacy cleanup. IndexedDB alone is insufficient protection. Native SQLCipher/SecureStore-key adapter is implemented but physical-device encryption/native OAuth remain gated. Future encrypted cloud backup is opt-in and unbuilt.

Current callback: `http://localhost:3000/api/dexcom/callback`. HTTPS testing must use the actual assigned tunnel origin consistently in backend configuration and Dexcom portal registration; no address/deployment is invented.

### Five-stage checklist

- [x] Stage 1: architecture inspection and minimal reuse plan.
- [x] Stage 2: session-bound sandbox OAuth and protected rotating backend tokens.
- [x] Stage 3: transient official range/EGV retrieval, normalization and analytics compatibility.
- [x] Stage 4: real sandbox G7 retrieval through Create and actual labeled PNG export.
- [x] Stage 5: foreground incremental sync, ephemeral web cache, encrypted native adapter contract, dashboard/Create integration, isolation/deletion/backoff tests and documentation.

Live Stage 5 initial/overlap: 1,678 readings; fresh check skipped EGV retrieval; Create selected 2026-11-16. Automated suite: 340 pass, clean typecheck and development export. Native SQL tests simulate cipher support; phone/production readiness is not established.

Public release still requires verified identity/recovery, Dexcom production approval/terms, stable HTTPS hosting, private vault ACLs/key rotation/backups, native handoff/device verification and dependency/security review. Creative polish stays with Claude. STOP after Stage 5.

## Historical architecture proposal and prior evidence


**Stage 4 complete (16 November 2026):** explicit in-memory Create source selection, UTC historical-day artwork, mandatory sandbox provenance and a real G7 sandbox verification command are implemented. Live dataRange/devices/EGV responses and an actual 1080×1920 browser PNG export passed. See [DEXCOM_SANDBOX_TEST_RESULTS.md](DEXCOM_SANDBOX_TEST_RESULTS.md). Historical Stage 1/2/3 observations below remain for context; durable health storage, production access and background sync remain deferred.

**Stage 3 update (16 November 2026):** owner authorized a transient in-memory provider and development viewer, documented in [DEXCOM_STAGE3.md](DEXCOM_STAGE3.md). Stage 2 account/session/OAuth/token infrastructure is reused. Durable local storage and cloud sync in the historical plan below are deferred by Stage 3's memory-only requirement. Live backend verification now retrieves 277 official simulated sandbox readings after a UTC query-format correction; 297 automated tests pass. Restart an older running backend to load the fix. Stage 4 is not started. Missing-configuration observations in the original review below are historical.

Stage 1 architecture review · 16 November 2026 · inspection and documentation only

## 1. Decision and scope

**Continue the existing Expo application and its existing Node backend. Refactor the backend's durable glucose ingestion into a transient, authenticated relay; store raw history in a separate device-local repository. Keep Dexcom credentials and tokens exclusively on the backend.** Do not add a second backend, rebuild the UI, or move the project.

The initial shell directory was `C:\Users\conor\Documents\Codex\2026-11-12\le`. The project was confirmed at `C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca`; subsequent repository commands used that directory explicitly.

This review covers the current working tree, including existing uncommitted modifications and the untracked `server/` directory. These are existing user work and must be preserved. The attached larger identity/achievements/reactions brief supplies context only: the current instruction authorizes **this document alone**, with no implementation, deployment, account creation, tunnel launch, credentials configuration, or health-data connection.

Evidence is source inspection, not a successful live integration. No `.env` contents, credentials, database contents, or real glucose data were inspected. No server, build or tests were run: `npm test` rewrites `.test-build` and opens test servers. Existing test files and historical verification notes are distinguished below from current test results.

## 2. Current repository architecture

| Area | Actual implementation and reusable parts | Gaps relevant to Dexcom |
| --- | --- | --- |
| Frontend | `package.json`: Expo SDK 58, React 19.3, React Native 0.88.1, strict TypeScript, `expo-router/entry`. `app/_layout.tsx` composes QueryClientProvider, DemoStore, fonts, navigation and feature flags. Thin routes re-export screens in `src/screens/`. | No authenticated frontend API client or real sign-in flow. |
| UI and Story Studio | Themed primitives in `src/ui.tsx`; Create in `src/screens/create.tsx`; reusable controls in `src/components/create/`. Six templates in `src/art/templates.ts`: minimal trace, daily recap, transparent overlay, real side, humorous, milestone. Day/week selection, photo backgrounds, contents preview, story/portrait/square export and native sharing paths already exist. | Preserve design and export machinery. Add provenance and accurate period/statistic handling rather than duplicate templates. Physical-device behavior is not newly verified here. |
| Backend | `server/index.ts` → `server/app.ts` → `server/http.ts` + `server/routes.ts`. Built-in `node:http`, `node:sqlite`, `node:crypto`, run by installed `tsx` through `npm run server`. Binds `127.0.0.1:3000` by default. Frontend defaults to `http://localhost:8081`. | Existing service should be extended. It currently serves APIs, not the frontend bundle, and is not deployment-ready. |
| Authentication | `server/session.ts` creates an anonymous development user with a signed opaque, HttpOnly, SameSite=Lax cookie, hashed session lookup, and 30-day expiry. | Explicitly **not real account authentication**. No account recovery, cross-device identity, logout/revocation lifecycle, or verified external identity. Local profile fields and post author `You` are not authentication. |
| Database | `server/db.ts` uses additive SQLite migrations: `users`, `sessions`, `oauth_states`, `dexcom_connections`, and `egvs`. Default file `server/data/gluca.sqlite`; directory is Git-ignored. Tokens are encrypted; raw EGV rows are not. | No SQLite row-level security, explicit file ACL setup, encrypted raw-data database, or retention/backup policy. Server authorization is the only access boundary. |
| Social persistence | `src/store.tsx` saves the broad State under AsyncStorage key `gluca-demo-v1`: posts, preferences, profile, events, CSV readings and other local features. | **There is no deployed social database or Supabase integration to reuse.** Keep private health storage separate from this social/demo state and from any future social database. |
| Providers | `src/providers.ts` defines `GlucoseProvider { id, connected, getReadings(start,end) }`, working Mock and CSV providers, and rejecting planned Dexcom/Apple Health/Health Connect factories. | `DexcomGlucoseProvider` is still a placeholder. `Reading.source` already allows `dexcom`, but does not describe account, environment, record ID, limit status or sync metadata. |
| Data selection | `src/hooks/use-readings.ts` selects CSV if `state.imported` is nonempty, otherwise Mock; query key includes the full imported array. | No network call or Dexcom selection exists in this hook. Add explicit active-source state and account/source/revision-based query keys. |
| Dashboard | `src/screens/glucose.tsx`, `src/components/glucose-chart.tsx`, `src/chart-scale.ts` consume the common hook and analytics. | Current source copy treats every non-Mock source as CSV. Add connection state, last sync versus last reading, source/environment, delay and range-limit labels. |
| Analytics | `src/analytics.ts` adapts to the single pure implementation in `src/art/analytics.ts`: duration-weighted average/SD/CV/range fractions, five-minute contribution cap, coverage and chart gaps. | UTC→wall-clock conversion and deduplication are unsafe over DST fall-back; see section 8. Reuse the calculation algorithm with UTC interval semantics. |
| Local import/export | `src/csv.ts`, `src/screens/import.tsx` parse locally, preview and confirm CSV replacement. JSON export currently serializes the broad State. `src/export.ts` exports artwork separately. | Do not place Dexcom history into broad State and accidentally include it in generic JSON export. Keep CSV and demo operational without accounts or network. |
| Flags/configuration | `src/flags.ts`: `dexcomApi` defaults false. `app.json` has `scheme: gluca`. `.env.example` already describes backend settings and unused public Supabase placeholders. | No actual frontend `EXPO_PUBLIC_API_BASE_URL` usage exists despite a documentation claim. A public API URL is configuration, never a token or secret. |

### Existing API surface

| Route | Current behavior |
| --- | --- |
| `GET /api/health` | Public mode/health status. |
| `POST /api/session`, `GET /api/session` | Create/check anonymous development session. |
| `GET /api/dexcom/connect` | Requires session, stores hashed expiring OAuth state, redirects to Dexcom. |
| `GET /api/dexcom/callback` | Exchanges code on server; accepts absent cookie using stored state/session association; stores encrypted tokens, starts server sync, redirects to web settings. |
| `GET /api/dexcom/status` | Session-scoped connection metadata and server reading count. |
| `POST /api/dexcom/sync` | Session-scoped forced ingestion into server SQLite. |
| `GET /api/glucose?start=...&end=...` | Session-scoped read of persisted server EGVs, bounded window. |
| `POST /api/dexcom/disconnect` | Deletes stored tokens, optionally server readings. |
| `POST /api/dexcom/delete-data` | Deletes server readings; currently does not cancel in-flight work/reset the cursor. |

Useful existing mechanisms: parameterized per-session queries, hashed single-use state, AES-256-GCM token encryption, server-only token exchange, single-process refresh sharing, request timeouts for data/refresh calls, typed errors/backoff, no-store JSON, no-referrer redirects, redacted path-only logs, production-host refusal, and a simulated-fetch test kit.

Documentation drift matters: `AGENTS.md`, README and parts of `PROJECT_MAP.md` still say no backend. `DECISIONS.md` records the recent server work but describes frontend API wiring that is not present. `DEXCOM_INTEGRATION.md` has useful research but marks portions of the reference unreadable that were accessible in this review. Preserve these files now; reconcile them in a later authorized implementation stage. Do not infer current test counts or passing status from old notes.

## 3. Official Dexcom V3 findings

The following facts were checked against public official pages on 16 November 2026. No authenticated portal or API request was made.

### OAuth contract

Use authorization-code OAuth at `GET /v3/oauth2/login`, with `client_id`, matching `redirect_uri`, `response_type=code`, `scope=offline_access`, and unpredictable state. Exchange on the server with form-encoded `POST /v3/oauth2/token`, sending client credentials, code, redirect URI and grant type. Refresh uses the same token endpoint. Codes are single-use and expire in one minute; access expiry comes from `expires_in` (example: 7200 seconds). Refresh tokens rotate, work once, and last at most one year. Dexcom requires server-held secrets/tokens, including for mobile integrations. Authorization can be withdrawn through the user's Dexcom Permissions settings; no revocation endpoint is documented here. PKCE support/requirements and localhost/custom-scheme acceptance are not established by the reviewed guide. [Authentication](https://developer.dexcom.com/docs/dexcom/authentication).

The login reference marks state required while the guide calls it optional: Gluca must always require it. The token reference explains `refresh_expires_in: 0` as no idle expiry, not permission to disregard the guide's maximum lifetime. Generated examples use a documentation mock host; that host is not the application API. [Login reference](https://developer.dexcom.com/docs/swaggerv3/other/getloginv3), [token reference](https://developer.dexcom.com/docs/swaggerv3/other/posttokenv3).

### Hosts, constraints and data availability

| Purpose | Official base URL |
| --- | --- |
| Sandbox | `https://sandbox-api.dexcom.com` |
| US production | `https://api.dexcom.com` |
| EU/outside US | `https://api.dexcom.eu` |
| Japan | `https://api.dexcom.jp` |

The official overview lists G7 support and TLS 1.3. Data windows are at most 30 days; `startDate` is inclusive, `endDate` exclusive, queried against `systemTime`. The app limit is 60,000 calls/hour, with 429 on excess. Mobile uploads are delayed one hour in the US and three hours elsewhere; receiver USB uploads differ. `systemTime` represents the device's UTC clock, which can drift; `displayTime` is device-local. These are retrospective records, not live sensor monitoring. [Endpoint overview](https://developer.dexcom.com/docs/dexcomv3/endpoint-overview).

### Exact EGV and available-range contracts

`GET /v3/users/self/egvs` returns an envelope with `recordType`, `recordVersion`, provider `userId` and `records`. Preserve `recordId`, `systemTime`, source display time, units, status, trend and required source provenance. A nullable value is not a fabricated numeric sample. Low/high sentinels 39/401 represent below/above the measuring limits, not exact values to display. The enum permits mmol/L although prose says mg/dL; validate units explicitly and quarantine unknown/inconsistent records rather than assume. [EGV reference](https://developer.dexcom.com/docs/swaggerv3/other/getestimatedglucosevaluesv3).

`GET /v3/users/self/dataRange` returns an envelope and nullable `egvs`, `calibrations`, `events`, each containing `start`/`end` with `systemTime`/`displayTime`. It accepts optional `lastSyncTime` to discover ranges with newly uploaded data. Its time strings omit offsets even for phone data: preserve source text and interpret `systemTime` as a UTC clock value, not Windows local time. This schema is now verified; null EGV ranges must become a valid empty state instead of `UnexpectedSchema`. [Data-range reference](https://developer.dexcom.com/docs/swaggerv3/other/getdatarangev3).

### Access is a separate gate

Registration/credentials do not establish production access. Sandbox accounts are simulated, with per-user available dates; discover those dates rather than request today blindly. Sandbox data is not a formal validation dataset. [Sandbox documentation](https://developer.dexcom.com/docs/dexcom/sandbox-data).

Production Limited Access requires an app-specific upgrade/approval and allows up to five authorized users. Commercial Full Access requires its own technical/commercial review; approval is not assured. The consent covers several data scopes together; Gluca should still fetch only needed EGV/range resources. The account's actual approval, region and contractual allowance for social graphics are unverified. [Scopes and Access](https://developer.dexcom.com/docs/dexcom/scopes-access).

## 4. Recommended hybrid architecture

```text
Private local client                         Existing Node backend
--------------------                         ---------------------
Demo / CSV / Dexcom source selector           Verified Gluca identity + sessions
Private glucose repository                   OAuth state + consent/connection metadata
  web: IndexedDB                             Encrypted Dexcom access/refresh tokens
  native: encrypted SQLite                   Transient EGV relay, no durable raw history
        | authenticated bounded request                |
        | <---- normalized records in transit ---- Dexcom V3
        v
Atomic local upsert + local checkpoint
UTC analytics -> existing dashboard -> existing Story Studio
Explicit per-field sharing preview -> separate social snapshot only
```

“Local-first” means durable glucose history belongs to the device. The backend necessarily processes authorized glucose transiently to keep Dexcom tokens off clients; do not claim health data never traverses a server. No third-party analytics, media processor, logs, queue payloads, traces, crash dumps, CDN cache or backup should retain relay bodies.

### Backend responsibilities

- Reuse the current server, crypto helpers and provider client. Persist encrypted tokens, authenticated owner mapping, consent version, connection ID/generation, environment/region, provider account subject, expiry and limited operational state. Provider subject and sync metadata are themselves sensitive; minimize retention and access.
- Replace `syncUser`'s database ingestion with bounded fetch/normalize/relay. Stop automatic server-history ingestion from the callback. Adapt `/api/glucose` into the authenticated bounded relay and `/api/dexcom/sync` into coordination/status rather than a second permanent history store. Define one shared fetch path, not duplicate Dexcom clients.
- Keep token-vault SQLite initially on a private persistent volume for one backend instance. The local/private process must exclusively access it. No browser/database credentials or direct SQL interface.
- Add a forward migration that ends raw EGV retention after an explicitly planned export/transition decision. Do not rewrite migration history or silently erase any existing user database. Check main database, WAL/journal, backups and host logs; SQL DELETE alone does not prove forensic erasure. Stage 1 neither reads nor deletes those files.
- Raw-response processing must be memory-bounded and finish within a request. No after-callback job should silently retain or accumulate history when no client is present.

### Local repository and source ownership

Introduce one interface for `getReadings`, atomic upsert, source-specific deletion and checkpoints, with platform adapters. Key a Dexcom record by Gluca owner + provider account + environment/region + record ID. Preserve UTC timestamp, display-time text, original value/unit, trend/limit status, acquisition/source identity and ingestion time. Store only needed device metadata, not every transmitter identifier.

Mock remains generated and independent; CSV retains its local parser/preview and its own namespace. Add explicit active-source selection: connected Dexcom with zero records must show an empty/error state, not silently fall back to synthetic glucose. Do not merge CSV, sandbox and production histories or double-count overlapping sources by default. Reading `recordId` is authoritative; a missing required ID should be rejected/quarantined rather than derive identity from a mutable glucose value.

Keep raw Dexcom rows outside `State.imported`, broad social state, generic state export, and query keys. TanStack Query may hold bounded in-memory selected intervals; use owner/source/generation/repository revision keys and clear private caches on logout/source change. Derive chart and story data through the existing shared hook/provider, not screen-level network calls.

## 5. Authentication, credentials and permissions

**Current answer: the repository does not yet have appropriate production authentication/permissions for real-user token persistence.** Session-scoped queries are a reusable foundation, not a completed identity/security system. SQLite has no RLS; exact-origin CORS and a custom header do not substitute for authenticated ownership.

- Controlled private sandbox tests may use the existing clearly labeled development sessions after callback/configuration fixes. Keep anonymous session creation disabled in any real-data/public environment.
- Before real-user persistence, extend this same backend with verified stable Gluca identities, session regeneration, logout/revocation/expiry, user deletion and account recovery. Select a maintained identity/OIDC solution in Stage 2; this does not require a second Gluca API backend. Do not invent a Supabase service simply because placeholder variables exist.
- Derive owner from verified server session, never a submitted user ID/profile. Test every private route with two owners, expired sessions and forged requests. If a later managed database permits direct user access, add deny-by-default grants/RLS; keep the token vault server-only even then.
- Keep `DEXCOM_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET` and tokens server-only. Existing AES-256-GCM can be retained, with authenticated binding to owner/connection/token field, key versioning and rotation planning. Restrict filesystem/service-account permissions; keep encryption keys outside the DB and its backups.
- In development, use the existing ignored root `.env` for server settings with careful process separation. Production uses host-managed secrets/KMS; never ship the root file with static assets or a mobile bundle. `DEXCOM_CLIENT_ID` need not be treated as a password, but keep configuration centralized. No secret is requested by this plan.

### Concrete repairs before credentials are exercised

1. `server/config.ts` checks the API host but not HTTPS: `http://sandbox-api.dexcom.com` currently passes. Require canonical HTTPS allowlisted origins, no userinfo/custom port/path/query, and validated callback/app origins. Existing callback suffix validation alone is insufficient. Keep sandbox-only enforcement until production approval.
2. `server/routes.ts`/`dexcom/oauth.ts` accept a missing callback cookie. Require binding to the initiating browser session for the web flow; for native, implement a separate authenticated, one-time browser/app transaction. Random state plus stored user association must not be described as universally preventing account-linking attacks when browser binding is absent.
3. Add exchange timeout and strict token-response validation. Require a new valid refresh token; retaining an already-consumed refresh token on malformed responses is unsafe. Handle uncertain refresh outcomes without blindly replaying single-use credentials.
4. Refresh/sync locks currently live in process memory. Scope them to connection generation; before multiple server instances, use database/distributed locking and compare-and-swap token updates. One atomic write does not make an upstream refresh and DB commit a single transaction.
5. Never shorten an upstream retry delay to the current 15-minute cap; honor valid Retry-After and add bounded jitter/backoff. Persist reconnect state after exhausted 401 recovery. Rate-limit session/connect/status/sync endpoints, not only forced sync.
6. Disconnect/delete/reconnect must invalidate in-flight work. Increment a connection generation, cancel/ignore stale responses and prevent deleted readings from reappearing. Reset relevant checkpoints on delete; reset account/environment/backoff state on replacement. Do not mix the old account's readings with a newly authorized account.
7. Preserve no-store/no-referrer and redacted application logs; configure proxy/tunnel/hosting logs to omit callback query strings, credentials, request/response bodies and glucose payloads. Add payload/timeout limits and secure headers. Test token/database isolation, not just CORS.

## 6. Callback and exact redirect URL strategy

### What is known now

The correct **existing route** is `/api/dexcom/callback` on the Node backend. Its direct local address is `http://127.0.0.1:3000/api/dexcom/callback`; that is a diagnostic local endpoint, **not a verified Dexcom-registerable redirect URI**. Expo port 8081 and `gluca://` are not the backend token-exchange callback.

No owned deployment hostname or assigned tunnel address is established by the inspected configuration. Therefore a literal public redirect URI cannot honestly be supplied yet. Its exact value must be **the actual HTTPS backend origin plus `/api/dexcom/callback`**, identically registered in the Dexcom portal and configured as `DEXCOM_REDIRECT_URI`. Do not invent a hostname or assume a tunnel is a stable production service.

### Recommended Windows web testing topology (later stage)

Prefer one browser origin for app and API to preserve session binding and avoid third-party-cookie behavior:

1. Keep Metro at 8081 for ordinary demo/CSV development. Build `dist/` when ready for an OAuth test.
2. Minimally extend the existing Node service on 3000 to serve **only `dist/` static assets and allowlisted SPA routes** alongside `/api/*`. This static-serving capability does not exist yet. Never serve the project directory, `.env`, `server/`, databases, debugger or administration tools. Alternatively use a same-origin reverse proxy; that is transport infrastructure, not another application backend.
3. Expose that existing service with an approved HTTPS tunnel. For an already-installed ngrok client, the later command is `ngrok http 3000`; no tunnel is started in Stage 1. Inspect service features and logging before any real data; a tunnel operator terminates/handles traffic and must be included in the privacy review.
4. Copy its **actual assigned** HTTPS origin. Set `APP_BASE_URL` to that origin and `DEXCOM_REDIRECT_URI` to that origin followed by `/api/dexcom/callback`. Open the web app at the tunnel origin, create/authenticate the session there and keep API requests relative to `/api`. A tunnel URL change requires portal/config changes and creates a different browser storage origin; history does not migrate automatically.
5. With the origin consistently HTTPS, require Secure HttpOnly session cookies. Do not rely on localhost cookies arriving at an unrelated tunnel domain. Test redirects/refresh/CORS/cookie behavior in Edge and Safari.

The current frontend at localhost:8081 and backend at localhost:3000 can remain for local-only work; however, merely adding a tunnel callback to that split-origin setup does not fix cookie binding. Do not weaken SameSite rules or accept missing cookies globally to make it appear to work.

### Intended web flow

1. Explicit Connect action under the Gluca session reaches the existing `/api/dexcom/connect`; strengthen initiation against unwanted cross-site navigation (authenticated POST initiation or a CSRF-bound one-time launch ticket). Store hashed random state, owner, initiating session, environment, expiry and approved return destination.
2. Browser navigates to Dexcom's official consent page. Dexcom credentials never enter Gluca.
3. Dexcom redirects to the registered backend callback. Validate state, one-time use, expiry and matching session; reject denial/invalid requests without storing a connection. Consume the authorization code promptly on the server.
4. Store encrypted connection credentials and consent metadata. Redirect only to an allowlisted Gluca route, currently `/settings?dexcom=connected|denied|error`; exclude code/state/tokens/provider error text. “Connected” means authorization succeeded, not that readings were downloaded.
5. The authenticated active client reads connection status, requests the available range and downloads normalized EGV windows into its local repository. The callback no longer starts durable server ingestion.

### Native mobile return

Reuse `scheme: gluca` for an app return route such as `gluca://dexcom/complete`, **after** the HTTPS backend callback. Do not register that scheme as the confidential backend callback or put Dexcom tokens/codes into it. The native app API session and system-browser cookies are different security contexts: create a server-bound, expiring launch transaction from the authenticated app and require a one-time app-held verifier to complete it. Browser launch tickets must have narrow scope, not grant API/history access.

The deep link may report a coarse result/opaque non-authorizing correlation value; the app confirms status using its own authenticated backend session. Use an allowlisted return target and an actual development build for predictable scheme handling. A future verified universal/app link is preferable for public distribution. Native browser launch and return are not implemented today.

### Public hosting

Once separately authorized, publish a stable owned HTTPS origin serving the web app and `/api` through the same Node service or ingress. Register **`https://<actual-owned-host>/api/dexcom/callback`** after replacing the placeholder with the real host, and use exactly that string throughout. Keep sandbox and production configurations/registrations isolated; verify the account-region combination with Dexcom. Do not hardcode an unowned example domain or mechanically flip the sandbox guard.

## 7. Storage strategy and limitations

| Data | Local development | Public deployment recommendation |
| --- | --- | --- |
| Client secret and vault key | Server-only ignored environment; synthetic sandbox use only. | Managed secret store/KMS; restricted process identity and rotation. Never static hosting variables exposed to clients. |
| Dexcom access/refresh tokens | Existing encrypted backend SQLite, after session/callback repairs. | Protected token vault on the same backend; stable authenticated owner, encryption, least privilege, retention/deletion and backups. |
| Raw EGV history | New dedicated local repository. Existing server `egvs` persistence must be retired deliberately, not silently reused. | Device-local by default; transient backend transit only. No central raw-history archive without a later explicit opt-in design. |
| Gluca session | HttpOnly cookie for same-origin web sandbox. | Secure HttpOnly browser cookie; native app-session credential held in OS secure storage. This is a Gluca credential, never a Dexcom token. |
| Social posts | Preserve existing demo state and behavior. | Separate future social store containing only approved snapshots/media. No join/path to private glucose history. |
| Analytics/statistics | Calculate locally with UTC-safe period bounds. | Same local computation. No readings/captions/identifiers in telemetry; keep current off/local-only policy. |

**Browser:** use IndexedDB for indexed transactional history and checkpoints, not a growing AsyncStorage/localStorage JSON blob. Browser data is origin-specific, subject to quota/eviction and user clearing; private-mode persistence differs. Request persistence where supported but provide explicit export/deletion and quota failure handling. Moving localhost→tunnel→production creates separate storage namespaces; no automatic transfer or complete-history guarantee. [Browser storage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

IndexedDB is not application-level encryption. For persistent real health history, plan encrypted records with an explicit unlock/key lifecycle, using Web Crypto and a separately reviewed key derivation strategy; an automatically retrievable same-origin key does not protect against XSS. At minimum enforce CSP, reduce third-party scripts and clear locked/private memory on logout. Until those decisions and threat tests are complete, keep persistent browser tests synthetic, or offer explicitly disclosed memory-only real-data handling only after approval.

**Native:** recommend `expo-sqlite` with SQLCipher in a development/production build for private history, and `expo-secure-store` for the database key and narrowly scoped Gluca session credential. SQLCipher is not included in Expo Go; configuration alone is insufficient—verify `cipher_version` and fail closed rather than silently writing plaintext. Preserve the existing demo/CSV Expo Go experience. [Expo SQLite/SQLCipher](https://docs.expo.dev/versions/latest/sdk/sqlite/).

SecureStore is for small protected values, not entire reading histories, and has platform/biometric limitations. Test key loss, reinstall, backup restore, logout and deletion; make no promise of cross-device recovery from local-only storage. [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

**Future encrypted cloud sync:** introduce only with separate explicit consent. Keep a distinct encrypted-health store and device-managed encryption keys; the existing token-vault key is not an end-to-end cloud key. Define recovery, new-device enrollment, revocation, conflicts, retention and deletion before enabling. Server scheduler convenience must not silently opt users into raw-data cloud storage. No cloud-sync implementation or dependency is needed now.

## 8. Automatic sync and analytics integration

- First device connection: obtain available dates, select up to the latest 30 days within that range, and fetch bounded chunks through the authenticated relay. The existing range parser/window planner and normalization are starting points, not verified live behavior.
- Commit validated rows and a **per-device, per-source checkpoint atomically**. Advance only after local success; backend fetch success is not proof of local delivery. An interrupted response or quota failure must be retryable/idempotent. A second device starts from its own checkpoint, not another device's server cursor.
- Trigger sync after connection, on app open/resume and while active subject to a conservative throttle, connectivity and backoff. Reuse existing five-minute throttle/six-hour overlap as starting policies, not clinical requirements. Avoid full-history reloads on every screen render.
- Use `dataRange(lastSyncTime)` when a committed checkpoint is available to discover late uploads, including older timestamps. Overlap alone cannot guarantee capturing corrections older than six hours; add a bounded periodic recent-window reconciliation and a deliberate historical reimport path. Track latest sample time separately from last successful fetch/commit.
- Keep backend retention empty when no client is online. Web tabs and mobile operating systems do not guarantee continuous background execution; promise automatic catch-up on return, not always-on sync/alarms. Server scheduling without a retained delivery store cannot guarantee off-device history accumulation. Optional future encrypted cloud sync is a separate decision.
- Preserve and validate `low`/`high` limits throughout charts, exact-reading inspectors, statistics and SVG exports. Render bounds, not fictitious precise sentinel values. Specify whether approximate sentinels contribute to averages and disclose the chosen policy consistently. Unknown units/status/schema failures must not become precise samples.

### Existing calculation and sharing issues that block real-data readiness

1. `src/analytics.ts` converts UTC to shifted wall time, then `toEngine` deduplicates by that shifted timestamp. Two fall-back-hour instants can collapse; spring-forward produces a false apparent gap. `src/art/model.ts` fixes day duration at 24 hours, and Create has fixed-ms filtering. Keep numerical duration/coverage calculations on UTC instants, derive local calendar boundaries in one declared reporting timezone, and use the same bounds for dashboard, art and snapshots. Reuse `computeStats` and gap logic; do not write another analytics engine. Test 23-/25-hour days, travel and out-of-order/delayed records.
2. Provenance currently mislabels a Dexcom Reading as CSV on the dashboard and as demo in `storyArtwork`; art models accept only demo/CSV. Introduce explicit Mock, CSV, Dexcom sandbox and Dexcom production metadata. Sandbox graphics must visibly remain simulated. Production source labeling must never be inferred from imported-array length.
3. `src/components/create/publish-card.tsx` publishes both average and TIR when either is selected, and calls `summarize` with default targets rather than the artwork's chosen range. Before real data, snapshot only individually approved fields with the same range/period; refresh approval when data, options, source or period changes. Preserve the existing preview UX and create no automatic social posts.

## 9. Exact change map for later stages

All paths below are relative to this unchanged project root. These are proposed edits, **not edits made in Stage 1**.

| Existing paths | Minimal intended change |
| --- | --- |
| `server/config.ts`, `server/index.ts`, `server/app.ts` | Strict HTTPS/origin/config validation; sandbox gate; production startup policy; same-origin static hosting or ingress integration without exposing project files. |
| `server/session.ts`, `server/http.ts` | Sandbox-only anonymous sessions; verified identity/session lifecycle; cookie/proxy handling; authorization, CSRF, headers and rate limits. |
| `server/routes.ts`, `server/dexcom/oauth.ts` | Session-bound initiation/callback, safe native transaction return, timeout/response validation, connection generation, remove callback server-history ingestion. |
| `server/crypto.ts`, `server/db.ts` | Reuse encryption; key version/AAD support and forward token/consent/source migrations; planned retirement of server EGV storage. Never rewrite shipped migration entries. |
| `server/dexcom/client.ts`, `server/dexcom/errors.ts` | Strict rotating refresh, connection-scoped locks, reconnect persistence, Retry-After/error handling and app-level request budgeting. |
| `server/dexcom/normalize.ts`, `server/dexcom/sync.ts`, `server/dexcom/data-routes.ts` | Verified nullable range schema; bounded transient relay; account/source identity; remove durable EGV writes/reads; cancellation/delete semantics and safe normalization. |
| `src/types.ts`, `src/providers.ts`, `src/hooks/use-readings.ts` | Rich private reading/source metadata, repository-backed Dexcom adapter, explicit source choice, bounded reactive local queries and revision-based cache isolation. |
| `src/state.ts`, `src/store.tsx` | Persist source preferences separately; preserve old demo/CSV migration; keep Dexcom raw history out of social state. |
| `src/screens/settings.tsx`, `src/screens/import.tsx` | Existing UI for Connect/Reconnect/Sync/Disconnect and local data deletion/export; truthful server-transit/privacy copy, source-aware reset. |
| `src/screens/glucose.tsx`, `src/components/glucose-chart.tsx`, `src/components/page.tsx` | Correct source, sandbox label, data availability, delay, last-sync/reading separation, limit status, empty/offline/reconnect states. Preserve layout. |
| `src/analytics.ts`, `src/art/analytics.ts`, `src/art/model.ts`, `src/days.ts` | UTC-duration calculations and consistent calendar bounds; extend existing helpers instead of duplicate calculations. |
| `src/screens/create.tsx`, `src/story.ts`, `src/art/templates.ts`, `src/components/create/publish-card.tsx` | Reuse artwork/export system; correct provenance, matching period/range, per-field sharing approval and immutable snapshot. |
| `src/components/post-card.tsx` | Only if needed for optional snapshot fields; preserve all existing reactions/design and add no new social behavior. |
| `src/art/telemetry.ts`, `src/telemetry.ts` | Keep enum-only, off/local by default. Prefer no connection-health telemetry; if source enum must change, no account/reading values or free text. |
| `app/_layout.tsx`, `src/flags.ts`, `app.json` | Initialize shared API/connection orchestration only when enabled; retain `dexcomApi: false`; development-build/native-return configuration as needed. |
| `.env.example`, `.gitignore`, `package.json`, `package-lock.json` | Document actual nonsecret API origin, secure platform packages/build requirements and data ignores. No forced dependency upgrade or unrelated installation. |
| `tests/server-crypto-config.test.ts`, `tests/server-oauth.test.ts`, `tests/server-routes.test.ts`, existing analytics/time/day/art/domain/e2e tests | Extend existing suite; distinguish mocked provider tests from actual sandbox verification. |
| `AGENTS.md`, `README.md`, `docs/PROJECT_MAP.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/DEXCOM_INTEGRATION.md`, `docs/DEVICE_TESTS.md` | Reconcile stale architecture/verification statements in later stages; record privacy decision superseding server raw-history storage. |

New modules with a single responsibility: `src/services/api.ts` (authenticated transport), `src/services/dexcom-sync.ts` (device orchestration), `src/repositories/glucose.ts` (contract), `src/repositories/glucose.web.ts` (IndexedDB), `src/repositories/glucose.native.ts` (encrypted SQLite), `src/hooks/use-dexcom-connection.ts`; optionally `server/auth.ts`, `server/static.ts` for the selected identity/hosting strategy and `app/dexcom/complete.tsx` re-exporting `src/screens/dexcom-complete.tsx` for native completion. Add pure contract/schema helpers only where shared, with no backend crypto imported into the frontend. These paths supplement the existing architecture, not replace it.

New targeted test files: `tests/server-dexcom-sync.test.ts`, `tests/server-dexcom-client.test.ts`, `tests/dexcom-normalize.test.ts`, `tests/glucose-repository.test.ts`, `tests/dexcom-sync.test.ts`, and a Dexcom mock flow under `tests/e2e/`. Platform storage/native auth also require device tests, not only the plain TypeScript test runner.

## 10. Dependencies and public-hosting transition

Core server repair can use existing built-ins, installed `tsx`, and existing tests. React Query, Expo Linking, SVG, FileSystem, view-shot and sharing packages already cover the existing UI/export flow. Do not add Express, another database service, or an unofficial Dexcom SDK just to implement these endpoints.

Proposed native additions, only when their stage is authorized: Expo-compatible `expo-sqlite`, `expo-secure-store`, and `expo-web-browser` for system browser launching; add `expo-auth-session` only if its lifecycle helpers reduce custom work. Web navigation itself needs no auth package. AuthSession/browser helpers must orchestrate a server flow, never exchange/store Dexcom tokens on the phone. [Expo AuthSession](https://docs.expo.dev/versions/latest/sdk/auth-session/).

Use native IndexedDB/Web Crypto on web initially; an IndexedDB wrapper is optional only if repository complexity warrants it. A maintained verified-identity/session integration is required before public users; exact provider/library, recovery requirements and cost are still decisions, not installed dependencies. Select SDK-compatible package versions at implementation time and document the reason; do not install anything for Stage 1.

Hosting should begin with one Node instance and private persistent token-vault storage; a static-only host cannot perform secure OAuth refresh. Keep the stable HTTPS web/API origin, secret injection and writable DB path configurable. A container/VM with persistent volume is the smallest conceptual transition; do not deploy it now. If scaling to ephemeral or multiple instances, move the token/metadata vault to an appropriate managed persistent database and add cross-instance locks, without introducing a competing API backend. SQLite on ephemeral serverless filesystems is not a persistence strategy.

Local raw history stays local across deployment. Offer an explicit private export/import migration where needed; never upload the user's old AsyncStorage state wholesale. Keep future social media storage separate, access-controlled, and limited to approved published snapshots. Review Dexcom licensing/attribution/social-export terms, hosting/tunnel subprocessors, privacy obligations and app-store requirements before public real-data use. Do not claim compliance, Dexcom approval or guaranteed access from technical security features.

## 11. Five-stage implementation checklist

Model names requested in the attached orchestration brief (Haiku/Sonnet/Fable 5.2) are unavailable in this Codex session. Stage 1 used the available model with independent read-only backend/frontend reviews and one document writer. Future recommendations describe workload classes rather than pretending those models were invoked: standard implementation model for bounded code/tests, stronger architecture/security review for identity/callback/crypto, lightweight model only for mechanical documentation. Keep edits to shared files/migrations sequential.

| Stage | Dependencies and bounded tasks | Acceptance / expected outcome |
| --- | --- | --- |
| **1 — Inspect and decide (this delivery)** | Inspect existing working tree and official docs; inventory auth/storage/provider/UI; document minimal architecture and exact callback path. | This file only. Existing code/design preserved. No credentials, integration run, installation or deployment. **Complete when document is reviewed. Stop here.** |
| **2 — Secure backend and sandbox OAuth foundation** | Requires Stage 1 acceptance. Reuse server; fix HTTPS/config validation, callback/browser binding, bounded exchange, strict refresh rotation; choose real identity architecture, implement it before any real users. Add consent/generation metadata and token access controls; plan raw-table transition. Establish same-origin test serving and actual sandbox redirect registration with owner participation. Security review before credential exercise. | Mock tests reject forged/reused/expired/cross-session state and cross-user routes; no tokens/secrets leak; callback denial safe; wrong protocol/host rejected. Actual sandbox OAuth is separately labeled and only attempted after explicit next-stage authorization; anonymous sessions remain private sandbox-only. |
| **3 — Private local repository and transient relay** | Depends on Stage 2 owner/session/source contract. Implement web/native repository adapters, exact EGV/range validation, UTC/limit policy, account/environment isolation; refactor server sync to bounded transient fetch. Native encryption/build can be a separate platform subtask after the common contract. | No persistent server raw EGV writes/cache/queue; local atomic upsert/checkpoint; repeated/out-of-order/corrected records handled; null ranges valid; UTC/DST tests pass; failed local writes do not advance checkpoints. Explicit migration/delete plan for preexisting server data, with no unapproved destructive action. |
| **4 — Connect, automatic catch-up, charts and Story Studio** | Depends on Stage 3 and a working Stage 2 flow. Add one API client, provider selection, connect/sync/reconnect/disconnect/delete UI, app-resume catch-up and backoff; correct source labels, bounds and per-field publishing. Preserve current design and all unrelated functionality. | Mock/CSV work offline and flag-off makes zero requests. Authorized sandbox data flows to local history, dashboard and existing templates; statuses/delays correct. Export dimensions/transparency/contents verified; selected post fields match preview. Delete/disconnect races and two-device checkpoints tested. No badges/achievements/challenges/reactions implemented or expanded. |
| **5 — Readiness, real-user approval and hosting transition** | Depends on Stage 4 validation and separate owner authorization. Verify real identity/session lifecycle, database/host permissions, restore/key rotation, native device flows, browser quota/XSS risks, deletion/export, privacy/Dexcom licensing and production access. Select owned HTTPS origin, infrastructure and region; configure production only after grants and explicit approval. | Unit/integration/e2e/device/security evidence recorded. Repeat official sandbox flow with available dates; never label mock success as live. Public/real-user gates remain closed until approvals. Production callback registered with actual host, stable token persistence and no server raw-history retention. No deployment occurs merely because the checklist is ready. |

Existing tests are reusable but were not executed in this stage. Later checks: `npm run typecheck`, `npm test`, `npm run test:e2e`, Expo compatibility and web/native export checks. Add refresh rotation/concurrency/uncertain outcomes, data-range null/schema, rate-limit, normalization/units/limits, delete/reconnect races, account isolation, late upload and local delivery tests. Existing OAuth test assumptions may lag the callback's extra background sync; inspect before claiming the suite passes.

## 12. Unresolved decisions and release gates

- Actual Dexcom app access level, sandbox/production credentials configuration and account region are not inspected. Registration alone is insufficient; do not request the secret in chat.
- No actual public hostname/tunnel has been assigned. The route is settled; the registrable literal URL remains dependent on the chosen HTTPS origin.
- Confirm Dexcom's allowed callback URI rules, region/registration behavior, PKCE support and social-image/storage licensing before production. Do not use undocumented endpoints or direct sensor Bluetooth access.
- Select verified Gluca identity/recovery requirements before real-user tokens. Development anonymous identities cannot meet the “connect once across visits/devices” promise reliably when cookies expire or are cleared.
- Choose browser encryption/unlock/recovery policy and native development-build approach. Browser-local storage can be erased; no-backup/local-only history is not recoverable by the backend. Future encrypted cloud sync remains opt-in and unbuilt.
- Approve the transition away from existing server raw-history retention, including any data export, physical deletion and backups. No current DB was inspected or changed.
- Set correction/backfill reconciliation horizon, local retention bounds and reporting timezone. Test them against real API contracts using simulated fixtures first; don't claim arbitrary older corrections are captured by a fixed overlap.
- Resolve out-of-range calculations/display and DST behavior before real health data reaches charts, graphics or a local social snapshot.

**Stage 1 ends with this document. No application code, configuration, dependencies, existing documentation or project location is changed. Wait for the owner's next instruction before Stage 2.**
