# Stage 2 — Dexcom sandbox OAuth setup

16 November 2026. Authorization only, in the existing Gluca app/backend. No glucose download or synchronization; no dashboard, Story Studio, achievement, challenge or reaction implementation. Existing demo and CSV behavior stays local.

## Implementation

The default-off `dexcomApi` flag reveals a Settings panel with Gluca sandbox account creation/sign-in, Connect Dexcom, Connected/Disconnected/Reconnect status, connection check, disconnect and sign-out. Accounts use unique usernames, salted scrypt password hashes, rate limits and signed HttpOnly sessions. They are separate from the fictional demo profile and from Dexcom credentials. No account is needed for demo/CSV graphics. These test accounts have no password recovery, email verification or production identity-service integration.

The existing Node server now requires an authenticated account for private connection routes. Old anonymous sessions cannot authorize Dexcom. Each authorization has hashed 32-byte random state, ten-minute expiry, single use, initiating browser-session binding and account authorization generation. New flows invalidate older pending flows. Callback handles denial, expiration, replay, missing cookie, foreign session and ambiguous parameters. It exchanges the short-lived code on the server; redirects never contain codes or tokens.

Access/refresh tokens are AES-256-GCM ciphertext bound to owner, connection generation and field. Refresh updates both tokens atomically after strict validation. Process-local sharing plus a database lease prevents concurrent reuse; ambiguous/failed refreshes require reconnection rather than blind replay. Backoff honors upstream Retry-After without truncating a long delay. Disconnect invalidates pending authorization and deletes credentials; late code/refresh responses cannot recreate them. Sign-out revokes the current Gluca session and pending state, but retains the account's encrypted connection for a subsequent sign-in.

No EGV/dataRange request runs after callback. Authenticated data endpoints explicitly return 501. Dormant earlier ingestion modules remain unmounted, and their provider fetch function is disabled. Existing raw-history migrations/files are not purged; **this stage writes no raw glucose**. Future data retention/migration remains Stage 3 work.

## 1. Preserve configuration and enter credentials locally

PowerShell, from the existing project:

```powershell
Set-Location 'C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca'
if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
```

Edit `.env` on your computer; do not paste its contents into chat. Existing `.gitignore` rules exclude `.env` and `server/data/`. Never replace a populated encryption key casually: saved tokens would become unreadable.

```dotenv
DEXCOM_CLIENT_ID=<your app id>
DEXCOM_CLIENT_SECRET=<your app secret, backend only>
DEXCOM_REDIRECT_URI=http://localhost:3000/api/dexcom/callback
DEXCOM_API_BASE_URL=https://sandbox-api.dexcom.com
DEXCOM_ENVIRONMENT=sandbox
APP_BASE_URL=http://localhost:3000
BACKEND_PORT=3000
SERVE_WEB=true
TOKEN_ENCRYPTION_KEY=<32 random bytes in base64>
SESSION_SECRET=<at least 32 random characters>
DATABASE_PATH=server/data/gluca.sqlite
```

To generate missing keys without printing them or replacing populated values (PowerShell 7, after preserving `.env` above):

```powershell
$oauthText = Get-Content -LiteralPath '.env' -Raw
foreach ($keyName in @('TOKEN_ENCRYPTION_KEY', 'SESSION_SECRET')) {
    $emptyKeyPattern = '(?m)^' + $keyName + '=[ \t]*\r?$'
    if ($oauthText -match $emptyKeyPattern) {
        $newKeyValue = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
        $oauthText = [regex]::Replace($oauthText, $emptyKeyPattern, "$keyName=$newKeyValue")
    }
}
Set-Content -LiteralPath '.env' -Value $oauthText
Remove-Variable oauthText,newKeyValue -ErrorAction SilentlyContinue
```

The server reads root `.env`; no frontend module imports backend configuration. Expo bundles only explicitly referenced public variables. Never prefix the client secret, encryption/session keys or tokens with `EXPO_PUBLIC_`; never import `server/` from `src/`. No frontend API base variable is needed: requests are relative to the same origin.

## 2. Protect the database and environment file

Token encryption does not replace filesystem protection. Restrict `.env` and `server/data/` to your Windows/service account. Inspect inherited NTFS permissions using `icacls .env` and `icacls server\data`; remove unintended user/group access through Windows Security permissions before exposing a tunnel. Do not blindly alter shared folders or required system/administrator grants. No automatic Windows ACL changes were made. On POSIX, new DB files/directories receive owner-only modes.

SQLite has no RLS or whole-database encryption here. Password hashes, usernames and session metadata are sensitive too. The backend alone opens the DB, uses parameterized owner-scoped queries, and never serves it. Protect backups; keep the token key outside the DB archive. Mature public account recovery, operational security and key rotation tooling remain release gates.

## 3. Build and launch on one browser origin

```powershell
$env:EXPO_PUBLIC_FLAGS = 'dexcomApi'
npx expo export --platform web
npm run server
```

Open **`http://localhost:3000/settings`**, using localhost consistently. First-time users see the normal Welcome screen first; choose demo/CSV, then Settings. `SERVE_WEB=true` serves only the exported `dist/` assets and allowlisted SPA routes alongside the existing API. It never serves the project directory, `.env`, server source or database.

For ordinary demo development, leave `dexcomApi` off and use `npm run web` on 8081 as before. Do not use that separate Metro origin for the browser-bound OAuth test. Native OAuth browser handoff is not implemented in this stage: test the web version on Windows or iPhone; native demo/CSV remain available.

Missing/incomplete OAuth configuration leaves the backend unconfigured/mock. Production Dexcom hosts/environments and noncanonical/non-HTTPS provider URLs are refused. The callback must be exactly on `APP_BASE_URL`. Configuration messages report names, not secrets.

## 4. Exact callback to register

With the default local configuration the exact callback is:

```text
http://localhost:3000/api/dexcom/callback
```

Register it **only if Dexcom's portal accepts localhost HTTP**. Official documentation requires matching redirect values but does not establish local HTTP acceptance; no URI was registered or live consent attempted here.

If the portal needs HTTPS, use an already-approved/configured tunnel client to expose this existing backend, for example:

```powershell
ngrok http 3000
```

Copy the **actual assigned HTTPS origin**, then configure:

```text
APP_BASE_URL=<actual assigned HTTPS origin, no trailing slash>
DEXCOM_REDIRECT_URI=<that same actual HTTPS origin>/api/dexcom/callback
```

Register that exact resulting URI in the Dexcom application, restart the backend, and open/sign in to Gluca at the assigned HTTPS origin. A localhost cookie will not arrive at an unrelated tunnel domain, and the callback intentionally rejects missing cookies. HTTPS configuration adds Secure cookies. A changed tunnel origin requires portal/config updates and creates a separate browser-storage origin.

No tunnel/deployment was created here. Review the tunnel provider and permissions first; disable body capture/inspection and redact callback queries in ingress logs. Expose only Gluca's app/API listener, not a workspace/database/debugging service. A stable production hostname must be chosen and registered later; none is invented in this document.

## 5. Live sandbox verification (your local configuration required)

1. Enter credentials/keys locally and register an accepted matching callback. Start the backend, enable/build the panel and sign in/create a Gluca sandbox account with its own passphrase.
2. Click Connect Dexcom. Expect `https://sandbox-api.dexcom.com/v3/oauth2/login` with `response_type=code`, `scope=offline_access` and state. Gluca never asks for a Dexcom password. Select a simulated sandbox account on Dexcom's hosted screen.
3. Authorize and return through the backend callback to Settings. Confirm Connected, then reload. This proves stored authorization, not real-user G7 data or downloaded history.
4. Check the connection at token expiry. For controlled testing, authenticated `POST /api/dexcom/refresh` with the CSRF header can force a rotation check; it returns no token. Revocation is discovered at refresh, not instantly while an old access token is still valid.
5. Test denied authorization, reconnect, disconnect and sign-out/sign-in. Disconnect removes Gluca's stored credentials; revoke separately under your Dexcom account's Permissions if desired. Sandbox accounts do not necessarily offer production revocation controls.
6. Confirm there are no `/egvs` or `/dataRange` requests or new raw-history rows and demo/CSV readings are unchanged.

## API and security boundaries

| Method/path | Behavior |
| --- | --- |
| `POST /api/accounts` | Rate-limited sandbox account registration; username/passphrase → authenticated cookie. |
| `POST /api/session` | Password sign-in with session rotation. Anonymous creation is removed. |
| `GET /api/session` | Session presence only. |
| `POST /api/session/logout` | Authenticated session/cookie and pending-state invalidation. |
| `POST /api/dexcom/connect` | Authenticated/CSRF-protected initiation; returns only official authorization URL. GET is intentionally rejected. |
| `GET /api/dexcom/callback` | Same browser session + valid one-time state → backend code exchange, then safe app redirect. |
| `GET /api/dexcom/status` | Authenticated boolean connection/reconnect/error fields, environment/mode; refreshes expiring tokens internally. |
| `POST /api/dexcom/refresh` | Authenticated token rotation; no token response. |
| `POST /api/dexcom/disconnect` | Removes credentials and pending grants, including race protection. |
| Existing data endpoints | Authenticated callers receive 501; Stage 3 disabled. |

Every POST requires `X-Gluca-Request: 1`; browser Origin is restricted to `APP_BASE_URL`. HttpOnly cookies are SameSite=Lax and Secure over HTTPS. Exact-origin CORS is additional protection, not authentication. Response/log copy is fixed/redacted. Tokens never appear in frontend state, URLs, logs or API responses. A durable refresh lease fails closed after an abandoned/uncertain exchange. The server does not run a background refresh daemon; the panel checks while mounted, and later visits refresh when needed. Public multi-instance rate limits, identity review and production approval remain future gates.

## Test evidence

```powershell
npm run typecheck
npm test
# First export the web bundle with EXPO_PUBLIC_FLAGS=dexcomApi:
npx playwright test --config playwright.oauth.config.ts
```

Type checking and **271 tests passed**: authentication/session isolation, state/denial/replay/expiry, token encryption/AAD ownership, concurrent rotation, revoked/malformed/uncertain refresh, long backoff, disconnect races, static-file restrictions, client URL allowlisting and absence of glucose retrieval. The pre-change baseline was 254/255 passing; its callback test detected the unwanted dataRange request, now removed. No unrelated failure was suppressed.

OAuth-enabled web production export passed. The included Playwright OAuth journey uses a mock hosted-consent page and synthetic provider responses; in this environment its worker could not launch (`spawn EPERM`), so it is **not marked passed**. Separate browser-assisted checks used an in-memory synthetic backend: account creation/sign-in controls, Disconnected/Connected/Reconnect and disconnect, plus 375/430/1280 px light/dark screenshots with no horizontal overflow. Mock connected/reconnect states were supplied by the preview controller, not live Dexcom consent. Screenshots: `docs/screenshots/stage2/`.

No live Dexcom credentials were configured, real account authorization attempted, health data downloaded, package installed or service publicly deployed. Native handoff/device flows and public production auth remain unverified/unimplemented. The default flag remains off; source selection, CSV and artwork calculations were not changed.

## Sources and next boundary

### Files changed for Stage 2

- Backend modified: `server/config.ts`, `server/db.ts`, `server/crypto.ts`, `server/session.ts`, `server/http.ts`, `server/routes.ts`, `server/dexcom/oauth.ts`, `server/dexcom/client.ts`, `server/testkit.ts`.
- Backend added: `server/limits.ts`, `server/static.ts`. Existing migrations remain intact; a forward migration adds account and OAuth concurrency metadata.
- Frontend added: `src/services/dexcom-oauth.ts`, `src/components/dexcom-connection.tsx`. Modified: `src/screens/settings.tsx` and a backward-compatible secure-input option in `src/ui.tsx`.
- Tests updated: `tests/server-crypto-config.test.ts`, `tests/server-oauth.test.ts`, `tests/server-routes.test.ts`, `playwright.config.ts` (keeps the separate flag-on OAuth journey out of the ordinary demo run). Added: `tests/server-stage2.test.ts`, `tests/server-static.test.ts`, `tests/dexcom-oauth-client.test.ts`, `tests/e2e/dexcom-oauth.spec.ts`, `playwright.oauth.config.ts`.
- Configuration/docs: `.env.example`, `README.md`, `AGENTS.md`, `docs/OAUTH_SETUP.md`, `docs/PROJECT_MAP.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/DEVICE_TESTS.md`, `docs/DEXCOM_INTEGRATION.md`; six screenshots under `docs/screenshots/stage2/`. The web `dist/` export was regenerated for validation; it remains Git-ignored. `.gitignore` already had the required credential/database exclusions and was preserved.
- No dependency/package manifest/lockfile change was needed for Stage 2. Preexisting uncommitted work, including identity/reaction/achievement files, was preserved.

Checked 16 November 2026: [official Dexcom OAuth guide](https://developer.dexcom.com/docs/dexcom/authentication), [V3 token reference](https://developer.dexcom.com/docs/swaggerv3/other/posttokenv3), and [Node crypto](https://nodejs.org/api/crypto.html). Dexcom documents server-held credentials, one-minute codes and rotating single-use refresh tokens; its example access expiry is 7200 seconds, while code uses the response value. Generated documentation mock hosts are never used as API hosts. PKCE is not assumed where support is undocumented.

**Stage 2 implementation and mocked verification are complete. Live sandbox verification waits for local credentials and an accepted registered redirect. Stop here; Stage 3 is not enabled.**
