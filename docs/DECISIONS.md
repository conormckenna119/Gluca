# Decisions

## Stage 7C — 17 November 2026

- Record prioritized findings before edits; implement only five small/medium application changes. Retain the existing five tabs and map dashboard/insights to My Glucose rather than inventing routes or redesigning the app.
- Finish overlay positioning with tap-again/web Escape; distinguish taps from drag/resize/pinch. Keep normalized transforms/export composition independent and unchanged.
- Reuse SDK Modal focus/Escape handling. Name the dialog and share footer inset handling in Sheet; remove the identity-only duplicate. No new modal framework or physical-device accessibility claim.
- Guard photo-picker concurrency/unmounts and scope its control to the existing session version. Keep photos local and full-resolution for now; bounded resize/orientation/large-image profiling is Stage 8 work.
- Change static product copy only. Memoize existing period filtering without changing medical calculations. No new analytics, persistence, credentials, synchronization or backend feature.
- Repair the old mocked Create fixture's origin/flags without relaxing production security. Report mocked journeys separately from live Dexcom verification. No ESLint configuration is invented; run existing formatter/compiler/tests and disclose the gap.

## Stage 7B — 17 November 2026

- Retain existing colour milestones and internal `tier`/legacy mark metadata; render one flat shield silhouette/outline with centered digits and identical dimensions. Remove ornaments, metallic effects and uncertainty symbols. User-visible wording says shield/style/years, never status.
- Keep completed-year/date precision mathematics unchanged. Explain partial/estimated dates in shared details/accessibility labels. Public projections still exclude all diagnosis date values; no public year/month permission is invented. Exact next anniversaries use owner-only dates. Visibility defaults/number privacy and backend storage are unchanged.
- Coordinate supporter/caregiver/advocate through one rounded frame and heart/helping-hand/awareness-ribbon symbols. No hierarchy, Dexcom dependency or access delegation. No new package or image asset.
- Keep one reusable identity renderer, bounded names/handles and 44px badge targets. Place existing post/comment markers in its optional metadata row to prevent crowded mobile author names. Preserve Fictional/You, time and visibility information.
- Reproduced profile-return double-pop when onboarding preceded the tab group: pop detail routes before targeted tab selection. Preserve navigator keys and editor state; cover this path plus existing navigation/Create behavior in browser regressions.
- Browser visual checks do not replace native device, safe-area, large-font or screen-reader verification. No deployment, new achievement/challenge system or additional stage is authorized.

## Stage 7A.5 — 17 November 2026

- Use one pure normalized center/uniform scale/opacity model, applied to SVG before both preview and export. Keep original solid layouts; retain session placement/photo when returning to transparency. Existing export canvas paints photo first. No new dependency: Pointer Events and native PanResponder/range adapters are sufficient.
- Limit scale to 50–150%, opacity to 20–100%, center to the inner 80% of the canvas. Cropping is intentional/visible; handles and reset remain reachable. Editing chrome and preview matte never enter captured/exported artwork. Mandatory synthetic/sandbox disclosure stays pinned/full opacity independently of editable composition.
- Keep layouts/photos in memory; do not add cloud/draft persistence or analytics fields. Preserve OAuth, glucose models/calculations/sync/cache and social data.
- Every template defaults to Minimal. Casual, Humorous, Motivational and Custom are opt-in; legacy Educational stays parseable but is not offered. Keep typed words through template/period changes and allow empty captions without fallback slogans. Do not rewrite historic posts or stored captions. Existing achievement/challenge edits are copy only.
- Native physical-device validation, native alpha capture and screen readers remain required. No rotation, individual-element editing, saved drafts, deployment or additional stage. Claude can revisit creative styling within these functional/privacy boundaries.

## Stage 7A — 17 November 2026

- Fix the demonstrated CSS paint order with a positioned SVG foreground above the photo; preserve template/analytics code and the existing photo-first/SVG-second export renderer.
- Keep one persistent root navigation shell, with the original icons/labels and existing Tab navigator routes. Use navigator-key actions through the SDK's synthetic root to avoid recreating the editor when leaving sibling stack screens.
- Keep account/welcome as explicit bar exceptions with Close; existing sheets retain Close/Done/Cancel. Use visual-viewport sizing and safe-area padding; physical-device verification remains open.
- An account-scope reset clears photos only when scope changes, allowing React Activity to resume unchanged screens. No raw glucose persistence, new dependency, schema change, feature system or public deployment. Preserve existing Stage 6B changes.
- Record actual PNG/browser evidence separately from the Playwright runner, whose worker spawning is blocked here. Stop after Stage 7A.


## Stage 6B — 16 November 2026

- Latest owner request authorizes onboarding/identity UI implementation and vector shield treatment in this stage. Existing design tokens, SVG tiers/emblems/date logic and registration are reused; no competing account/profile service.
- Extend the existing Node/SQLite backend with encrypted owner profiles and additive migration 5. Reuse AES-GCM vault key with independent profile owner context; missing encryption fails closed. Public response is a derived allowlist, not private-row serialization.
- Public handle is separate from the sign-in credential and unique on explicit save. Name/handle/bio/cropped photo are public; diagnosis/birthday dates never are. Device answers are self-reporting, independent of Dexcom OAuth.
- New profiles stay out of global plaintext device persistence. Preserve previous local profiles unchanged for explicit review, reset medical visibility on review, and never auto-upload them. Guest changes remain ephemeral.
- Add SDK-compatible `expo-image-manipulator ~58.0.16` via Expo install for local crop/128px JPEG resizing before save. Reuse ImagePicker; no cloud image/analytics service or original-photo upload.
- Existing exact/partial/leap-year shield convention is retained (Feb 29 → March 1 in non-leap years). Unknown dates remain approximate and never acquire invented anniversary parts. Midnight/resume updates are metadata/calendar only.
- Account changes invalidate identity and glucose; provider disconnect invalidates glucose while preserving identity. Broadcast messages contain only closed event/reason enums, with legacy-message support.
- Existing feed/following/community remain fictional local prototype. Real social ownership, verified production authentication/recovery/minimum-age policy and native account/device verification remain future gates, not Stage 6B claims. No deployment or additional stage is authorized.


## Stage 5 — 16 November 2026

- Owner authorized automatic foreground sync, storage/privacy controls and shared dashboard/Create. No public deployment or new social features.
- Web uses ephemeral memory rather than plaintext IndexedDB or a key stored beside ciphertext. Session-bound cache namespaces and short authoritative leases favor account isolation over indefinite offline access.
- Raw CSV import becomes session-only; legacy persisted raw readings are removed with a visible reimport notice, preserving source files/preferences/explicit posts.
- Native storage uses SDK-compatible expo-sqlite (~58.0.17, SQLCipher for large datasets), expo-secure-store (~58.0.3, key only), expo-crypto (~58.0.8, random key). Installed using Expo-compatible package versions. No unofficial Dexcom SDK/second backend. SQLCipher missing → fail closed. Android backups disabled. Native OAuth/device encryption still gated.
- Five-minute freshness, 24-hour correction overlap, first seven UTC dates and 30-day retention plus one selected historical period are bounded defaults, configurable in SyncConfig. No endless polling/full-account repeated download.
- Logout/disconnect/delete cancel private work, clear active caches and signal other tabs with metadata only. Existing explicit export/post snapshots remain user controlled. No auto-publish.
- Public production and optional encrypted cloud backup remain separate future approvals. Creative status-card polish can be revisited by Claude; preserve explicit source, delay, ephemeral-cache and export-consent semantics. Current advisory audit requires review before deployment.


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
