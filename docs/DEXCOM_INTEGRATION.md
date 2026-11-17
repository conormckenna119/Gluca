# Dexcom API V3 integration notes

**Stage 4 update (16 November 2026):** official G7 sandbox data now reaches the existing Create templates and image export through an explicit source choice. The new backend-only `/devices` check uses no date parameters and matches account subject privately. Live responses, 288 normalized readings, and a functioning 1080×1920 PNG were verified. [Full report and repeat commands](DEXCOM_SANDBOX_TEST_RESULTS.md). No production access or automatic sync enabled.

**Stage 3 update (16 November 2026):** authenticated, transient dataRange/EGV retrieval and an opt-in development viewer are implemented. Read [DEXCOM_STAGE3.md](DEXCOM_STAGE3.md) for Windows setup, normalization/privacy decisions, files and verification. Live backend retrieval now succeeds: 277 official simulated sandbox readings normalized, no raw database writes. A live-discovered query-format fix sends zone-less UTC timestamps; restart an already-running backend after updating. This supersedes historical connection-only/disabled-provider notes below. No automatic sync or raw-history persistence is enabled.

**Stage 2 implementation update (2026-11-16):** use `docs/OAUTH_SETUP.md` for the current connection-only implementation and verification record. `docs/DEXCOM_IMPLEMENTATION_PLAN.md` verified the previously unread dataRange schema and login/token reference details. Historical NOT VERIFIED entries below describe the original research snapshot; they do not mean glucose sync is enabled. Stage 2 makes token requests only.

Researched 2026-11-16 from the official Dexcom developer portal. Nothing here is from memory: anything that could not be read on an official page is marked NOT VERIFIED.

**Status key.** VERIFIED means it was seen on an official page on 2026-11-16 (date fetched for every row). NOT VERIFIED means the page did not state it, or the page could not be read.

**Source pages (all fetched 2026-11-16, all https://developer.dexcom.com):**
- A = `/docs/dexcom/authentication/` (OAuth guide)
- B = `/docs/dexcomv3/endpoint-overview/` (V3 endpoint overview)
- C = `/docs/dexcom/scopes-access` (Scopes and Access)
- D = `/docs/dexcom/sandbox-data` (Sandbox Data)
- E = `/docs/swaggerv3/other/getestimatedglucosevaluesv3` (egvs reference, also seen via `getdatarangev3` / `posttokenv3` pages, which render the same combined reference)
- F = `/docs/dexcom/getting-started`
- G = `/docs/dexcom/glossary`

**Pages that could not be read:** the site home (`/`) rendered only a title; `/docs/support` (FAQ), `/docs/support/compliance`, `/docs/devdexcom/gallery` are "Redirecting..." stubs with no content; `/docs/dexcom/endpoints/`, `/docs/dexcom/data-ranges/`, `/docs/dexcomv3/data-range`, `/docs/support/faq(s)` returned 404. The combined swagger reference pages were truncated before the `dataRange`, `devices`, `login` and `token` sections. The Data Licensing Agreement and developer terms were not found on any readable page. The dexcom.com Terms of Use was linked from the footer but not fetched.

## 1. Summary table

| Fact | Value | Status | Source |
| --- | --- | --- | --- |
| Auth type | OAuth 2.0 authorization code grant | VERIFIED | A |
| Authorization URL (sandbox) | `https://sandbox-api.dexcom.com/v3/oauth2/login` | VERIFIED | A |
| Authorization URL (US prod) | `https://api.dexcom.com/v3/oauth2/login` | VERIFIED | A |
| Token URL | `POST /v3/oauth2/token` on the same host | VERIFIED | A |
| `response_type` | `code`, only accepted value | VERIFIED | A |
| `scope` in the authorize request | `offline_access`, only accepted value | VERIFIED | A |
| Data scopes the user must accept | 4, all-or-nothing: EGVs, calibrations, events, device details | VERIFIED | C |
| Client secret required | Yes, in both code exchange and refresh bodies | VERIFIED | A |
| PKCE | Not mentioned | NOT VERIFIED | A |
| Authorization code lifetime | 1 minute, single use | VERIFIED | A |
| Access token lifetime | `expires_in` seconds; example shows 7200 (2 h) | VERIFIED (example only) | A |
| Refresh token lifetime | Max 1 year; single use; rotated on every refresh | VERIFIED | A |
| Redirect URI | Must match the one in app management; HTTPS, localhost, count not stated | VERIFIED (match) / NOT VERIFIED (rest) | A |
| Sandbox base URL | `https://sandbox-api.dexcom.com` | VERIFIED | B |
| Prod base URLs | US `api.dexcom.com`, EU/outside US `api.dexcom.eu`, Japan `api.dexcom.jp` | VERIFIED | B |
| How a client picks a region | Not stated | NOT VERIFIED | A, B |
| egvs/events/etc window | max 30 days per request, longer gives 400 | VERIFIED | B |
| How far back history goes | Not stated | NOT VERIFIED | B |
| Rate limit | 60,000 calls per app per hour, then 429 | VERIFIED | B |
| Data delay | about 1 h (US) / 3 h (outside US) for mobile-app uploads; immediate for USB receiver upload | VERIFIED | B |
| Sandbox can read real data | No, simulated data only | VERIFIED | D |
| Limited Access user cap | 5 real users | VERIFIED | C, F |
| Token revocation endpoint | None documented; user revokes at Dexcom.com | VERIFIED (none documented) | A |
| TLS | 1.3 required | VERIFIED | B |
| Public display/sharing terms, branding, retention | Not found | NOT VERIFIED | none readable |

## 2. OAuth 2.0 flow in V3 (source A, fetched 2026-11-16)

**Authorization request.** `GET https://api.dexcom.com/v3/oauth2/login` (sandbox: `https://sandbox-api.dexcom.com/v3/oauth2/login`). VERIFIED.
Query parameters: `client_id` (required), `redirect_uri` (required, must match app management), `response_type=code` (only accepted value), `scope=offline_access` (only accepted value), `state` (optional). VERIFIED.

**Token exchange.** `POST /v3/oauth2/token`, `Content-Type: application/x-www-form-urlencoded`. VERIFIED.
- Code exchange body: `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `client_secret`.
- Refresh body: `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret`.

**Client secret.** Sent in the token requests, so it is required. Docs: "should never be shared or distributed"; partners must store the client secret and tokens on their servers, and mobile integrations "should not store tokens on the mobile device". A compromised secret can be regenerated in app management, which invalidates the old one at once. VERIFIED.

**PKCE.** Not mentioned on the page. NOT VERIFIED (neither supported nor required as far as the docs say). Do not build on PKCE without asking Dexcom.

**Scopes.** The only accepted `scope` value in the authorize request is `offline_access`. Whether it is what makes a refresh token appear is not stated; the refresh token is simply described as part of the normal flow. Separately the user must accept four data scopes together (EGVs, calibrations, events, device details); developers cannot request a subset (source C). VERIFIED / "required for refresh token" NOT VERIFIED.

**Lifetimes.** Authorization code: single use, expires after one minute. Access token: `expires_in` in seconds, example `7200`; treat the real value as whatever `expires_in` returns. Refresh token: valid for a maximum of one year; each refresh token works once and each exchange returns a new refresh token and invalidates the old one (rotation), so the new one must be stored. The example response shows `refresh_expires_in: 0`, which the page does not explain. VERIFIED, except that the 2-hour figure comes from an example.

**Redirect URI.** Must exactly match the URI in app management. HTTPS requirement, localhost allowed, custom app schemes, and how many URIs can be registered are all not stated. NOT VERIFIED.

**State.** Optional, client-generated, returned on the redirect only if it was sent; its purpose is CSRF protection. VERIFIED. A denied request redirects with `error=access_denied`.

**Errors.** 401 on a data request: refresh. 400 on a refresh: refresh token is no longer valid, send the user through login again. Other detail follows RFC 6749 section 5.2. VERIFIED.

**Other.** After login the user sees a HIPAA authorization statement granting Dexcom the right to share their data. VERIFIED.

## 3. Hosts (source B, fetched 2026-11-16)

| Environment | Base URL | Status |
| --- | --- | --- |
| Sandbox | `https://sandbox-api.dexcom.com` | VERIFIED |
| Production US | `https://api.dexcom.com` | VERIFIED |
| Production EU and outside US | `https://api.dexcom.eu` | VERIFIED |
| Production Japan | `https://api.dexcom.jp` | VERIFIED |

How a client knows which host to use: not stated. The OAuth guide only documents US production and sandbox, and says the sandbox base URL replaces the production one. Whether a user's account region must match the host, and whether one app registration works on all regions, is NOT VERIFIED.

## 4. Endpoints we need

### `GET /v3/users/self/egvs` (sources B, E)

- Auth: `Authorization: Bearer <access token>`. VERIFIED.
- Query: `startDate` (inclusive) and `endDate` (exclusive), both required. ISO 8601 UTC timestamps to milliseconds; examples have no `Z` (e.g. `2025-02-06T09:12:35`). Queries run against `systemTime`. Max window 30 days; longer returns 400. VERIFIED.
- Time: `systemTime` is the device's UTC clock (not guaranteed to be true UTC; drift or user changes); `displayTime` is the device's shown local time, may be user-configurable. Mobile records include offsets; receiver records do not. VERIFIED.
- Response top level: `recordType` ("egv"), `recordVersion` ("3.0"), `userId` (unique per Dexcom account and per client), `records` (empty array if none). VERIFIED.
- Record fields (VERIFIED, source E):

| Field | Type | Notes |
| --- | --- | --- |
| `recordId` | string (UUID) | unique per client |
| `systemTime` | date-time | UTC per device |
| `displayTime` | date-time | local device time |
| `transmitterId` | string or null | hashed and encrypted |
| `transmitterTicks` | int64 | seconds since transmitter started |
| `value` | int32 or null | 39 = calculated below 40; 40 to 400 = measuring range; 401 = calculated above 400. 39 and 401 are used in calculations, "not displayed" |
| `status` | string or null | `high` (above 400) or `low` (below 40) |
| `trend` | string or null | none, unknown, doubleUp, singleUp, fortyFiveUp, flat, fortyFiveDown, singleDown, doubleDown, notComputable, rateOutOfRange |
| `trendRate` | double or null | mg/dL/min |
| `unit` | enum | unknown, mg/dL, mmol/L |
| `rateUnit` | enum | unknown, mg/dL/min, mmol/L/min |
| `displayDevice` | enum | unknown, receiver, iOS, android |
| `transmitterGeneration` | enum | unknown, g6, g6+, g6Pro, g7 |
| `transmitterGenerationVariant` | string | d1+, g6, g7, g715day |
| `displayApp` | string or null | e.g. G6, G7, DexcomOne, D1G7 |

- Trend vs `trendRate` (mg/dL/min): doubleUp +3 to +8; singleUp +2 to +3; fortyFiveUp +1 to +2; flat -1 to +1; fortyFiveDown -2 to -1; singleDown -3 to -2; doubleDown -8 to -3. VERIFIED.
- Units: the docs say glucose is always mg/dL and trend rates mg/dL/min, and converting to mmol/L is the client's job. The `unit` enum lists mmol/L as a possible value, which sits oddly with that; the docs do not reconcile it. Practical rule for Gluca: read `unit`, and if it is not `mg/dL`, stop and flag it rather than guess. VERIFIED (statement) / mmol/L behaviour NOT VERIFIED.
- Low/high out-of-range: see `value` and `status` above. For Gluca, 39 and 401 and any `status` of `low`/`high` mean "outside the measuring range", not a precise number; draw them as range-limited, never as 39 or 401 mg/dL.
- Missing data: no interpolation by the API; `value` may be null. VERIFIED that it is nullable.

### `GET /v3/users/self/dataRange`

- Needs no `startDate`/`endDate` (all endpoints except this one require them). VERIFIED (source B).
- Returns time fields `systemTime` and `displayTime` per data type. The exact response schema (field names, nesting) was NOT readable: NOT VERIFIED.
- Docs do not say how far back history goes, so the "start" of the range must come from this endpoint. NOT VERIFIED beyond that.

## 5. Limits and behaviour (source B)

- Rate limit: 60,000 calls per app per hour; over it returns HTTP 429. No `Retry-After` header is documented. VERIFIED / header NOT VERIFIED.
- Data delay (standard API): mobile-app uploads arrive about 1 hour late in the US and 3 hours late outside the US including Japan; a receiver uploaded over USB via Dexcom Uploader is available immediately. Difference by access level: not stated. VERIFIED. So this is never real-time.
- HTTP codes listed: 200 OK, 302 Found (auth redirect), 400 Bad Request (e.g. window over 30 days), 401 Unauthorized (token expired or invalid; refresh), 404 Not Found, 429 Too Many Requests, 500 Internal Server Error. Official per-code descriptions beyond this were not shown. VERIFIED (list).
- TLS 1.3 required. JSON responses; empty fields appear as `null`. VERIFIED.
- Devices: v3 supports G6, G7, G7 15-day, Dexcom ONE, ONE+ (ONE/ONE+ not in the US). Dexcom ONE returns empty arrays for events, calibrations. VERIFIED.

## 6. Sandbox (source D)

- Sign in: use `https://sandbox-api.dexcom.com`; at the login screen pick a sandbox user from a drop-down; no password. VERIFIED.
- Sandbox users: "Sandbox User - G6", "Sandbox User - G7", "Sandbox User - D1", "Sandbox User - G715DAY". VERIFIED.
- Date ranges: not listed; they differ per user. Call `/dataRange` to find out. VERIFIED (that range varies), actual dates NOT VERIFIED.
- Real data: no. The sandbox holds simulated CGM data that emulates real data and needs no live Dexcom account; it is not meant for formal testing or validation. Sandbox credentials reading real users: the page does not describe such a path, so treat as no. VERIFIED (simulated data) / the explicit "cannot read real data" wording NOT VERIFIED.
- All scopes are available in sandbox and production. Registration is free.

## 7. Access levels (sources C, F)

| Level | What it allows | Status |
| --- | --- | --- |
| Sandbox | Every registered app, simulated accounts only. Registration is free and gives app credentials. | VERIFIED |
| Limited Access | Production testing with real Dexcom users, up to 5 authorized users. Applied per app via "Apply for Upgrade" in My Apps. Dexcom Strategic Partnerships reviews a partnership request; if approved you get a non-negotiable Data Licensing Agreement to accept; then Dexcom updates the app status. | VERIFIED |
| Full Access | Required for commercial release. Per-app application: Full Access Questionnaire, Dexcom review and possible follow-up, technical and commercial review, fix any technical or UI issues, then Dexcom updates status. | VERIFIED |
| Research | Separate research portal. | VERIFIED |

Each app is reviewed independently. Approval is a Dexcom decision; nothing says it is assured, and no timeline or criteria are published on the readable pages. To be a Digital Health Partner a developer must follow the Data Licensing Agreement, publish and support at least one Full Access app, and keep at least one active connected user within 60 days of public availability and continuously after. Gallery listing is not an endorsement. Production data comes from G6, G7, G7 15-day, ONE and ONE+ mobile apps, or Clarity uploads. VERIFIED.

## 8. Revocation and disconnect (source A)

No token revocation endpoint is documented (the endpoint list is login, token, and the data GETs). The docs say users revoke at Dexcom.com by signing in and changing authorizations under Permissions; Dexcom then promptly stops providing data to the app. Data already provided is not affected. VERIFIED (that none is documented). For Gluca's "remove my data" button: delete our stored tokens and imported data, and tell the user to also revoke at Dexcom.com. An in-app "revoke at Dexcom" call is NOT available as far as the docs show.

## 9. Terms that affect this product

The Data Licensing Agreement, developer terms, compliance page, branding rules and FAQ could not be read (stub or 404 pages; the agreement is only presented after a Limited Access application). So the following are all NOT VERIFIED: rules on displaying or sharing glucose data publicly or in social images; branding and attribution requirements (use of the Dexcom name or logo); storage and retention limits; prohibited uses (alerts, treatment decisions, real-time claims).

What was verified and is relevant: tokens and the client secret must be stored on the server, not on a phone (A); Dexcom's data is delayed by 1 to 3 hours so cannot be presented as live (B); the user grants consent through a HIPAA authorization shown by Dexcom (A); listing in the Gallery does not mean endorsement (C). The Gluca rule "demo data is labelled" still applies; sandbox data must be labelled as demo.

## 10. Discrepancies against the product spec assumptions

| Assumption | Docs agree? |
| --- | --- |
| `https://sandbox-api.dexcom.com/v3/oauth2/login` | Agrees (A) |
| `/v3/oauth2/token` | Agrees; POST, form-encoded (A) |
| `/v3/users/self/egvs` | Agrees (B, E) |
| `/v3/users/self/dataRange` | Path agrees (B); response schema unread |
| `response_type=code` | Agrees; only accepted value (A) |
| scope `offline_access` | Agrees; only accepted value (A). Four separate data scopes also exist and are not requested by name |
| "Up to 30 days" initial history window | Partly: 30 days is the max window per request (B), not a documented history limit. How far back data exists is NOT VERIFIED; use `dataRange` and page in 30-day chunks |
| Backend-only client secret | Agrees, and stronger: the docs require tokens and secret on a server, and mobile apps should not store tokens (A). The pure-local, no-backend Gluca design cannot do this directly; it needs a server, which needs the owner's approval |

Other surprises: refresh tokens rotate on every use (a lost write means re-authorization); the code lives only 1 minute; `unit` can in theory be mmol/L although the docs say values are mg/dL; no PKCE or revocation endpoint is documented; only 5 real users until Full Access.

## 11. Open questions for the owner or Dexcom support

1. Does Gluca accept needing a backend (token store and secret)? This conflicts with the current local-only, no-network rules. Needs owner approval.
2. Is PKCE supported or required, and may a public mobile client work without a secret?
3. Which redirect URIs are allowed (HTTPS only? custom scheme? localhost? how many)?
4. How does a client choose between api.dexcom.com, .eu and .jp, and can one app credential be used on all three?
5. How far back does history go, and what does `dataRange` return exactly?
6. Is `offline_access` what produces the refresh token? What is the real access token lifetime and `refresh_expires_in: 0`?
7. What do the Data Licensing Agreement and Full Access review say about showing glucose values or charts in images users share publicly, branding, retention, and prohibited uses?
8. Will a consumer social app that shares glucose graphics be approved for Full Access? Approval criteria and timeline are not published; do not assume it.
9. Is there any token revocation endpoint?
10. Can the 1 to 3 hour delay vary by access level?
