# Decisions

Stage 4 decisions (2026-11-16): add an explicit Create source choice without changing the dashboard hook or persisting Dexcom rows. Use absolute UTC instants and historical UTC calendar dates for sandbox artwork to avoid DST folding; keep legacy demo/CSV time behavior. Extend existing artwork provenance with a non-removable sandbox simulation note, retaining every template and the existing export path. Keep device access confined to the backend's explicit verification command; devices require no date query. The live command reuses the protected account-owned connection and never logs subjects/tokens/individual readings. Rendered local verification artifacts are Git-ignored. No dependencies added. Creative styling remains a future Claude task; source controls use existing primitives.

Stage 3 decisions (2026-11-16): reuse the existing authenticated Node/SQLite token backend; return raw glucose transiently without SQL/device persistence. Keep the provider isolated from demo/CSV state and existing achievement hooks. Use the existing pure analytics engine with an explicit UTC adapter for diagnostics and honest full-calendar coverage denominators. No dependencies added. Configure Expo Router web `asyncRoutes: false`: development split chunks otherwise use eval and are rejected by the existing strict CSP. Synchronous web route bundling preserves CSP without enabling unsafe-eval; tradeoff is a larger initial route bundle. Public diagnostics remain blocked by build/server gates. Creative presentation is deferred to Claude. Details: [DEXCOM_STAGE3.md](DEXCOM_STAGE3.md).

Append new entries with a date. Do not rewrite history; add a superseding entry instead.

## Open: only the owner can decide

| # | Decision | Context | Blocks |
| --- | --- | --- | --- |
| D1 | Product name | Working name is "Gluca". The owner is concerned it may conflict with an unreleased product. A web search on 2026-11-12 found no exact match but many similar "Gluco…" apps. Earlier briefs also used "GlucoClub". Needs a trademark attorney's clearance search. The name lives in `src/art/brand.ts`; rename steps are in `docs/ROADMAP.md` M1 | Public release |
| D2 | Delete `_backup_before_claude/` | Copy of the source before the visual pass | M0 cleanup |
| D3 | Dark or light by default | Currently dark first (`dark: true` in `src/store.tsx`) with a light option | M6 |
| D4 | ~~Is the fictional community visible in the default build?~~ **Decided 2026-11-13: keep visible** (see Made) | | |
| D5 | Analytics provider | None today; telemetry is local only. A provider needs a privacy review and consent copy | After M9 |
| D6 | Real health data, backend, paid services, public deployment | All unapproved | M10 |

## Made

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-11-12 | Share-first: the smallest product is "data in, graphic out, you choose to share" | Owner's product direction update |
| 2026-11-12 | Artwork is one SVG string used for both preview and export | Guarantees the export matches the preview; testable without a device |
| 2026-11-12 | Range colours are amber (below), mint (in), lavender (above), always with words | No red or green success coding |
| 2026-11-12 | Demo data label on the image cannot be disabled | Synthetic data must never pass as real |
| 2026-11-12 | Statistics are duration-weighted with a 5-minute cap; gaps are never interpolated | Honest numbers with incomplete data |
| 2026-11-12 | Story safe margins 250 px top and bottom; portrait 110; square 90; plus an 8 px inner buffer | Platform UI overlaps story edges; glyph overshoot must not enter the margin |
| 2026-11-12 | Inter (SIL OFL 1.1) embedded in web exports | Same output on every device |
| 2026-11-12 | Telemetry is a closed enum-only spec, off by default, no remote sink | Health data cannot leak through analytics by construction |
| 2026-11-12 | Logging sheet uses wheel pickers plus a live glucose strip | Owner asked for the iOS alarm-style wheels and left the final choice open |
| 2026-11-12 | No carbohydrate or insulin amounts anywhere | Keeps the product out of dosing and treatment territory |
| 2026-11-13 | Owner approved the drop-with-peak logo in `assets/` | To be applied in-app in M1 |
| 2026-11-13 | `src/art/` is the source of truth for the engine; `prototypes/share-first-web/` is a frozen reference | Avoid maintaining two copies |
| 2026-11-13 | Correction to the entry above: the approved logo is not in `assets/`; those files are the stock Expo placeholder. The in-app mark was drawn from the written description (mint drop, near-black single-peak line) | Found during M1. The owner needs to supply the file or approve generating icons from the in-app mark |
| 2026-11-13 | In-app `Mark` draws its peak line in the `accentInk` token | Near-black on the light theme's dark green drop was too faint |
| 2026-11-13 | Owner chose to generate the app icon set from the in-app mark rather than supply a logo file | The original logo file is not in the repository; `tools/make-icons.cjs` makes the set reproducible |
| 2026-11-13 | D4: the fictional feed, Explore and clubs stay visible in the default build. `communityFeed` and `clubs` default to on; turning them off must still remove them from navigation. They stay labelled as a local demo with a fictional community | Owner's choice |
| 2026-11-13 | Create's day picker is built in-app (previous / next buttons plus a sheet listing the days that have data); no date-picker package | A native date picker can only be limited by a minimum and maximum date, not to the days that have data, and has no web version. No new dependency |
| 2026-11-13 | Added `expo-font` and `@expo-google-fonts/inter` | M5: load Inter at app start so the preview and native export use the same face as web exports. Font files ship in the app; nothing is downloaded at run time |
| 2026-11-13 | Added `expo-image-picker` | M5: pick a photo from the library as the background of transparent artwork. The photo stays on the device and is not saved in app state |
| 2026-11-13 | Bottom sheets and confirmations use a `Sheet` primitive built on React Native `Modal`; icons are drawn in `src/ui.tsx` with `react-native-svg` | Works on iOS, Android and web with no sheet or icon package. Not yet run on a phone (M7) |
| 2026-11-13 | M6 design direction: dark-first "calm instrument": one centred column (720 px max), eyebrow labels, large tight numerals, 20 px card radius, chips and icon buttons, at most one filled action per screen; status tone is carried by icon and words, never red or green | Keeps every screen in the same language as Create. D3 (dark or light default) is still the owner's; dark stays the default until decided |
| 2026-11-14 | Event logging uses a custom snapping wheel (`src/components/wheel.tsx`) with up / down buttons and screen-reader increment / decrement; no picker package | `@expo/ui` pickers are native-only and could not be verified here; a custom wheel works on iOS, Android and web. Revisit after the phone pass if it does not feel native |
| 2026-11-14 | Event labels are never drawn on artwork; only icons | Free text must not reach an exported image by accident, and the contents list can state exactly what is shown |
| 2026-11-16 | Owner approved a local backend that talks to the Dexcom **sandbox** only, plus the identity, Boosts and achievements spec. Production Dexcom data, deployment and real sign-in remain unapproved (D6) | Owner's brief of 2026-11-16. The server refuses to start against a production Dexcom host until D6 is decided |
| 2026-11-16 | Backend lives in `server/`: Node's built-in `node:http`, `node:sqlite` and `node:crypto`, run with `tsx`; no new npm dependency | The repository had no backend. Dexcom's docs require the client secret and tokens to stay on a server and say mobile apps must not store tokens. Built-ins keep the audit surface small |
| 2026-11-16 | "Sign in to Gluca" is a local development session for now: the server creates an anonymous user and an httpOnly, SameSite=Lax, signed session cookie. It is not real sign-in | Real accounts are M10. A session is still needed so a Dexcom connection is bound to one user and one browser |
| 2026-11-16 | OAuth state is 32 random bytes, stored hashed with the session id, single use, 10-minute expiry. No PKCE | Dexcom's docs do not mention PKCE (`docs/DEXCOM_INTEGRATION.md`); state is the documented CSRF protection |
| 2026-11-16 | Access and refresh tokens are encrypted at rest with AES-256-GCM (`TOKEN_ENCRYPTION_KEY`, random IV per record). Refresh is serialised per connection and the new refresh token is written in the same transaction | Dexcom refresh tokens are single use and rotate on every refresh, so a lost write or a double refresh breaks the connection |
| 2026-11-16 | Dexcom readings are stored on the server per user and served only to that user's session (`GET /api/glucose`). The app never receives Dexcom tokens | Sync needs a store for dedupe and incremental fetches. Supporters and followers have no route to another user's readings |
| 2026-11-16 | State-changing routes are POST, need the session cookie and a custom request header, and CORS allows only `APP_BASE_URL` | CSRF protection without a token framework |
| 2026-11-16 | Disconnect deletes the tokens Gluca holds and tells the person how to revoke access in their Dexcom account. Deleting imported readings is a separate, explicit choice | Dexcom documents no revocation endpoint |
| 2026-11-16 | The app reaches the server through `EXPO_PUBLIC_API_BASE_URL` (not a secret) and only while the `dexcomApi` flag is on. With the flag off the app makes no network call | Keeps demo and CSV modes fully local |
| 2026-11-16 | Kudos become Boosts in saved state now (`Post.reactions`); the wording on screen changes with the `boosts` work | One data shape for one or many reaction kinds; old saved posts are converted on load |
| 2026-11-16 | New flags `identity`, `boosts`, `achievements`, `healthAchievements`, `reactionPicker` all start off. `healthAchievements` stays off until a qualified clinical review | Unfinished work stays hidden; health-outcome medals are prototype only |

## Stage 2 decisions — 2026-11-16 (supersedes earlier OAuth assumptions)

- Reuse server/, node:http/node:sqlite/node:crypto and installed dependencies. No second backend or new runtime package.
- The owner authorized sandbox OAuth implementation. Anonymous sessions no longer qualify: sandbox Gluca accounts authenticate usernames/passphrases with salted scrypt and HttpOnly signed sessions. These are controlled test accounts without recovery/MFA, not public production identity readiness.
- Require the same authenticated browser session at callback; connect is now a CSRF-protected POST. APP_BASE_URL and callback origin must match; use existing backend static dist serving for browser tests. No global absent-cookie bypass or native handoff is enabled.
- Provider base must be canonical HTTPS sandbox. Tokens use AES-GCM owner/generation/field AAD, strict rotation and a durable refresh lease. Disconnect invalidates pending grants and late writes.
- Stage 2 explicitly disables glucose retrieval/persistence, superseding the earlier callback-ingestion decision. Existing schema/history are preserved, not silently deleted. No dashboard, artwork, source/provider, achievement or reaction behavior was implemented in this stage.
- Keep dexcomApi off by default. Settings alone offers connection management; demo and CSV stay usable offline without account creation.
- Live sandbox configuration/verification is pending; no hostname, credentials, tunnel or deployment is invented. Instructions and evidence are in docs/OAUTH_SETUP.md.

## Ownership of the Dexcom track (owner's decision, 2026-11-16)

- Codex handles the Dexcom developer API integration: everything under `server/`, the Dexcom client files (`src/services/dexcom-*.ts`, `src/components/dexcom-connection.tsx`, `src/screens/dexcom-data.tsx`), their tests and the Dexcom docs. The Stage 2 and Stage 3 decisions above stand; the earlier 2026-11-16 table rows about an anonymous session, a GET connect link and storing readings on the server are superseded.
- The Claude session keeps identity, privacy, communities, Boosts and achievements, and does not edit the files above.
- Left over from the Claude session's stopped sync task, for the Dexcom owner to remove or reuse: `server/dexcom/sync.ts` and `server/dexcom/data-routes.ts` (nothing imports them) and the `egvs` table in `server/db.ts`. They assume readings are stored, which Stage 3 decided against.
- Still for the owner, whoever builds it: the developer terms on showing glucose data in shared images could not be read on 2026-11-16 and should be checked in the Dexcom portal before any public use.
