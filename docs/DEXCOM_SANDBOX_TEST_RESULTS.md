# Stage 4 — Dexcom sandbox end-to-end verification

16 November 2026. Existing Gluca project, backend, account/token vault, providers, analytics, templates and image-export implementation reused. No new application, dependencies, production access, background scheduling, achievements or social features.

## Live results

| Check | Result | Evidence |
|---|---|---|
| Sandbox OAuth | **PASS** | Existing protected authorization reused. Authenticated Gluca owner mapping and a consumed OAuth state record were present; encrypted connection usable. A fresh callback/code exchange was not replayed in this stage. Existing callback/state/exchange validation is also covered by automated tests. |
| Sandbox User – G7 | **PASS** | Connected sandbox account returned two G7 device records, G7 apps, iOS/android platforms. Existing consent reused; dropdown not reselected during this run. |
| `GET /v3/users/self/dataRange` | **PASS — HTTP 200** | Official `sandbox-api.dexcom.com`; discover dates before selecting a historical day. |
| `GET /v3/users/self/devices` | **PASS — HTTP 200** | No date parameters, per the current official devices reference. Validated `device`/`3.0` envelope, records and matching private account subject. Only minimal device evidence retained in report. |
| `GET /v3/users/self/egvs` | **PASS — HTTP 200** | UTC query parameters use zone-less strings with milliseconds, inclusive start/exclusive end. Actual V3 `egv` envelope/records validated and subject matched privately against dataRange. |
| Selected period | **PASS** | **2026-11-15 00:00:00 UTC → 2026-11-16 00:00:00 UTC**, end exclusive. Chosen from available history, independently of today's date. |
| Records | **PASS** | **288 received, 288 normalized**, zero invalid/missing/out-of-period records, zero duplicate record IDs in this run. Earliest **2026-11-15 00:00:02.776 UTC**; latest **2026-11-15 23:55:02.853 UTC**. |
| Units/trends | **PASS** | Original mg/dL, canonical mg/dL, original time/device/trend metadata preserved. Non-null trend fields present. No individual readings or full account identifiers printed. |
| Analytics | **PASS** | Existing engine completed: 288 readings, approximately **99.897% time coverage**, nonempty chart series. Time in range, average, above/below and daily summary derive from those normalized records. Missing intervals are excluded from range percentages and reduce coverage. |
| Create | **PASS — actual browser** | Explicit **Dexcom Sandbox** source loaded November 15 and 288 readings in the existing Daily recap workflow. No CSV import or Gluca mock fallback. Existing template switching, units/range preferences and export infrastructure reused. |
| Image export | **PASS — actual browser/file** | Export PNG / Share generated a real PNG. Signature `89504e470d0a1a0a`, **1080 × 1920**, **1,966,369 bytes**. Saved download copied to `.dexcom-verification/sandbox-story.png`; opened and visually verified. Date/chart/statistics and mandatory **DEXCOM SANDBOX · SIMULATED** label present. No publication occurred. |

This is a genuine API exchange with the official **simulated** sandbox, not real personal G7 data and not a mocked HTTP reply. Account-scoped subjects were compared only in backend memory. No full subject, credentials, tokens, response bodies or individual measurements are included here.

Official references checked on 16 November 2026: [endpoint overview](https://developer.dexcom.com/docs/dexcomv3/endpoint-overview), [devices](https://developer.dexcom.com/docs/swaggerv3/other/getdevicesv3), [EGVs](https://developer.dexcom.com/docs/swaggerv3/other/getestimatedglucosevaluesv3), [sandbox accounts](https://developer.dexcom.com/docs/dexcom/sandbox-data). The devices-specific reference explicitly requires no query parameters, despite the overview's broader wording about dated endpoints.

## Automated evidence and environment limits

- **MOCK PASS:** `npm test` passed **314 tests, zero failures** in this run. Synthetic Stage 4 tests cover owner/subject isolation, device schema, provider-day compatibility, date selection, user units/range, missing-time coverage, DST, all template/format combinations, provenance and the backend-to-Create artwork path. These counts include the existing suite; mocked tests do not establish live success.
- **PASS:** `npm run typecheck`; development web export completed.
- **PASS:** `npm run test:dexcom:sandbox` contacted real sandbox endpoints and returned the live summary above. It renders an SVG through the same provider/day and existing story/analytics code used by Create. Its PASS covers those explicit live checks; PNG export is separately established by the actual browser/file evidence.
- **PASS — negative readiness check:** missing credentials produce **BLOCKED**, exit code **2**, with no provider fallback.
- **BLOCKED — Playwright runner:** `npm run test:dexcom:create` could not spawn its worker in this restricted environment (`spawn EPERM`). The committed isolated mock browser test verifies retrieval → Create → downloaded PNG signature/dimensions when run in an unrestricted local PowerShell. It has not been counted as an executed MOCK PASS here.
- **PASS — alternate browser verification:** computer-use browser automation exercised the real authenticated UI and download. It produced the PNG above. Responsive evidence and any remaining limitations are recorded in the final follow-up below.
- The restricted environment also blocked `tsx`/esbuild's helper process for `npm run server`. Verification started the **same** `server/index.ts` entry using the installed TypeScript compiler in-process, with the existing `.env` and database. No alternate application or mock backend was used. Normal Windows PowerShell can use `npm run server` as before.

## Security and storage

Final UI follow-up: Create was checked at **375, 430 and 1280 px in light and dark**, without horizontal document overflow. Screenshots are under `docs/screenshots/stage4/`. Existing Minimal trace and Daily recap selection worked with the retrieved source, date and statistics. Editing the date disabled export until it matched the loaded day; switching to empty CSV showed an empty state, while Demo loaded its own data rather than retaining Dexcom rows. The original light appearance and default viewport were restored. User range/unit handling is verified through the shared-engine automated tests; no real-phone test is claimed.

The backend retains encrypted OAuth credentials in its existing private SQLite vault. Parameterized owner-scoped requests, session/CSRF protection, connection revision checks, refresh rotation, sandbox-host allowlisting, request limits and no-store responses remain active. Devices are allowlisted only for explicit development verification; no new public metadata endpoint was added.

Retrieved glucose remains transient backend/client memory. Create's explicit source does not write raw readings to DemoStore, AsyncStorage/localStorage, query keys or telemetry, does not evaluate achievements, and does not expose its sandbox data through the local publishing panel. It clears private readings on navigation/tab hiding; source changes abort stale requests. An edited date must be loaded before export is enabled. Unavailable/empty/revoked connections cannot silently switch to demo/CSV. Disconnect remains available in Settings.

Only the user-requested rendered graphics are saved. `.dexcom-verification/` is Git-ignored, contains no token vault or raw JSON/CSV history, and is not served publicly. Existing `.env` and `server/data/` remain ignored. No new cloud storage or health database was introduced.

A final read-only metadata check confirmed the existing server `egvs` table contains **zero rows** after live verification and image export. The local backend was left running for review. The final empty-CSV check also confirmed export is disabled for data-dependent templates and no synthetic-data provenance label is substituted for CSV.

Existing public-release blockers remain: production identity/recovery, native OAuth handoff, deployment hardening and real-device validation. This stage uses sandbox data only and does not remove those gates. No new token/health-data exposure was found in this workflow.

## Repeat the verification on Windows

From the existing project, preserving your configured `.env` and keys:

```powershell
Set-Location 'C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca'
npm run dexcom:check
npm run typecheck
npm test

$env:EXPO_PUBLIC_FLAGS = 'dexcomApi,dexcomDiagnostics'
npx expo export --platform web --dev --max-workers 2
npm run server
```

Keep that backend terminal running. In another PowerShell, from the same directory:

```powershell
npm run test:dexcom:sandbox
# Optional explicit account/date, useful if more than one account is connected:
npm run test:dexcom:sandbox -- --username Conor --day 2026-11-15
```

Exit **0 = PASS**, **2 = BLOCKED** (configuration/authorization/G7 selection), **1 = FAIL**. The live command is intentionally separate from ordinary unit CI. It discovers history and chooses a completed UTC day by default; dates can become unavailable when Dexcom updates sandbox data. A multi-account vault requires an explicit matching username. Run this trusted backend command locally, never expose it as a public endpoint.

If authorization is needed, open **http://localhost:3000/settings**, sign into your Gluca account, Connect/Reconnect Dexcom, and select **Sandbox User – G7** on the official Dexcom screen yourself. The callback stays `http://localhost:3000/api/dexcom/callback` (or the exactly configured HTTPS tunnel origin). Never enter your Dexcom password into Gluca. See [setup](DEXCOM_STAGE3.md) for credentials/tunnel details; never paste secrets into chat or frontend variables.

For the actual graphic: open **http://localhost:3000/create**, choose **Dexcom Sandbox**, confirm/change the historical UTC date, press **Load selected Dexcom day**, choose an existing template, and **Export PNG / Share**. Expect a file with the chosen format's dimensions and the mandatory simulation label. Create still offers **Demo data** and **CSV data** through the same workflow. Use port **3000** for authenticated Dexcom tests; the separate Metro server on 8081 does not host this API.

Optional isolated **mock** browser regression, after the development export above:

```powershell
npm run test:dexcom:create
```

It uses only synthetic fixtures and its own in-memory backend. It cannot establish live sandbox success. No automatic production connection, background sync or social feature follows this stage.

## Stage 4 files

- Backend: updated `server/dexcom/client.ts` and `relay.ts`; new `devices.ts` and `sandbox-verification.ts` beside them.
- Shared Create: new `src/create-source.ts`, `src/hooks/use-create-readings.ts`; updated `src/screens/create.tsx`, `src/story.ts`, `src/art/model.ts`, `src/art/templates.ts`, `src/components/page.tsx`, and `src/components/create/export-panel.tsx`.
- Verification/config: new `tools/test-dexcom-sandbox.cjs`, `tests/dexcom-create.test.ts`, `tests/e2e/dexcom-create.spec.ts`, `playwright.dexcom-create.config.ts`; updated `package.json`, `playwright.config.ts`, `.gitignore`. No dependencies added.
- Documentation: this report plus README, AGENTS, PROJECT_MAP, ROADMAP, DECISIONS and the Dexcom integration/implementation/Stage 3 guides. Existing unrelated account/identity work was preserved.
