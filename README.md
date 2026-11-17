# Gluca

**Stage 7A.5 — movable story overlays and concise copy:** Create → Transparent overlay now supports grouped drag/pinch, desktop corner resizing, size/opacity sliders, keyboard/directional movement and reset. Placement survives photo/style/date changes; exports use the same normalized transform. All templates default to Minimal copy, with optional editable caption tones. [Editor guide](docs/STORY_EDITOR.md), [voice and tone](docs/GLUCA_VOICE_AND_TONE.md), [changed files, tests, evidence and limitations](docs/UI_REFINEMENT.md). 364 core tests and 7 browser tests pass; physical native device checks remain open.

**Stage 7A — focused UI fixes:** transparent story artwork now stays above an added photo, and one persistent bottom navigation serves normal tab/detail routes. Original templates, API/authentication and profile features are retained. [Causes, changed files, real PNG/browser evidence and repeat commands](docs/UI_BUGFIXES_STAGE7A.md). 360 core tests and typecheck pass; the Playwright worker is blocked by this environment, with direct browser verification recorded separately.


**Stage 6B — onboarding and identity:** existing account/profile/shield systems now support inclusive progressive onboarding, locally processed profile photos, public handles/bios, owner-encrypted backend profiles, explicit visibility controls and shared identity displays. Start with [ONBOARDING.md](docs/ONBOARDING.md), [IDENTITY_SHIELDS.md](docs/IDENTITY_SHIELDS.md) and [PROFILE_PRIVACY.md](docs/PROFILE_PRIVACY.md). Enable `identity,accounts` alongside your existing Dexcom flags, rebuild the development web export and restart the same backend. Native accounts/production release remain gated. Earlier stage notes below are historical.


**Stage 5 — automatic foreground Dexcom sandbox sync:** My Glucose and Create share a session-isolated cache. Open/resume checks, bounded incremental overlap, Sync Now, backoff and privacy controls are implemented. Live official sandbox verification retrieved **1,678 readings**, skipped fresh EGV downloads and verified overlapping refresh plus Create integration. **340 automated tests pass**, with clean typecheck and development web export. Browser history is **ephemeral memory**; reload requires online retrieval. The native SQLCipher adapter requires a custom build/device verification; native OAuth remains gated. No public deployment or permanent backend glucose history. [Setup and evidence](docs/GLUCOSE_SYNC.md) · [Security/production gates](docs/DEXCOM_SECURITY.md). Enable `EXPO_PUBLIC_FLAGS=dexcomApi,dexcomDiagnostics,dexcomSync`, rebuild development web and restart the existing backend. Creative polish remains for Claude.


**Stage 4 — verified Dexcom Sandbox → Create → PNG:** Create now offers explicit Demo, CSV and Dexcom Sandbox sources. A live G7 sandbox check retrieved 288 normalized readings for 15 November 2026, rendered the existing Daily recap template, and exported a verified **1080×1920 PNG** through the actual browser workflow. Nothing was published or added to a permanent raw-health store. Run `npm run test:dexcom:sandbox`; [full results, repeat commands and limitations](docs/DEXCOM_SANDBOX_TEST_RESULTS.md). This supersedes older statements below that Create accepts only demo/CSV. Development-only sandbox flags remain required.

**Stage 3 — Dexcom development data viewer:** the existing backend retrieves authorized sandbox dataRange/EGVs, normalizes them, and returns transient readings to the existing chart/analytics engine. [Windows setup, first retrieval, privacy, file list and limitations](docs/DEXCOM_STAGE3.md). Live backend verification retrieved 277 official simulated sandbox readings after correcting the UTC query format. Restart a running backend after updating. Demo/CSV remain functional, and the ordinary dashboard/Create still use those sources. No background sync or permanent glucose history is added. Historical Stage 2 notes below are superseded by this update.

Verify from this directory: `npm run typecheck`, `npm test`, `npm run dexcom:check`.

**Stage 2 OAuth update (2026-11-16):** the existing Node backend now supports authenticated sandbox Gluca accounts and encrypted Dexcom sandbox authorization. A default-off Settings panel connects, shows status and disconnects. No glucose is downloaded; demo/CSV remain local. See [Windows OAuth setup](docs/OAUTH_SETUP.md) for callback/tunnel configuration and verification limits. Older milestone descriptions below are historical, not the current backend status.

Local, mobile-first social prototype for people living with diabetes, with a share-first graphic maker at its core. React Native + Expo SDK 58, Expo Router, strict TypeScript, TanStack Query, local AsyncStorage.

> Not a medical device. No dosing, treatment or diagnostic advice. Demo data only: do not import real health data into this prototype (storage is unencrypted).

**Contributing (people or AI agents):** start with [`AGENTS.md`](AGENTS.md), then [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Run it

You need Node 22.13+ (or 24.3+ / 26+; odd versions such as 23 and 25 are unsupported) and npm.

```powershell
cd 'C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca'
npm install
npm run web          # opens http://localhost:8081 in your computer's browser
npm start            # starts the dev server with a QR code for your phone
```

## Try it on your phone

Pick the first option that works for you. All of them keep everything on your own network or device; nothing is deployed.

### Option 1: the web version in your phone's browser (fastest, no app install)

Works on iPhone and Android, and does not depend on Expo Go.

1. Put your computer and phone on the same Wi-Fi.
2. Run `npm run web`. Leave it running.
3. Find your computer's address: run `ipconfig` and note the IPv4 address (for example `192.168.1.23`).
4. On the phone, open `http://192.168.1.23:8081` (your address, port 8081).
5. If it doesn't load, allow Node.js through Windows Defender Firewall for **Private** networks when prompted (or Settings > Privacy & security > Windows Security > Firewall > Allow an app).
6. Optional: in iPhone Safari tap Share > **Add to Home Screen** for a full-screen, app-like icon.

On web, **Export PNG** downloads a PNG with the font embedded. On iPhone Safari the picture may open in a viewer: press and hold it and choose **Save Image**. Transparent PNGs are best layered in an editor or Stories sticker flow, because some apps fill transparency with black.

### Option 2: Expo Go (native app, QR code)

1. Install **Expo Go** on the phone (App Store / Google Play).
2. Run `npm start`, then scan the QR code (iPhone: Camera app; Android: inside Expo Go).
3. **Important:** this project uses Expo SDK 58. Expo Go only opens projects built for the SDK it supports. As of Expo's SDK 58 announcement, the store version of Expo Go for SDK 58 was "expected within a few weeks", so check what your store version supports at https://expo.dev/go. If it says the project is incompatible, use Option 1 or Option 3. On Android you can usually install the matching Expo Go build directly from https://expo.dev/go.
4. If the phone can't reach the computer (different network, VPN, school/work Wi-Fi), use `npx expo start --tunnel`. This needs `npx expo login` first.

### Option 3: a development build (any SDK, more setup)

Needed if Expo Go doesn't support SDK 58 yet and you want the real native app.

- **Android:** `npx expo install expo-dev-client`, then `eas build --profile development --platform android` (free Expo account) and install the APK.
- **iPhone:** requires a paid Apple Developer account (US$99/year) for device builds: `eas build --profile development --platform ios`. A Windows PC can build via EAS cloud but cannot run the iOS simulator.

Then run `npm start` and open the project from the dev build.

### What is and isn't verified on a phone

Native capture, photo-library permission and the share sheet are implemented but **have not been verified on a physical iPhone or Android phone**. A share sheet opening does not mean anything was posted; Gluca never posts for you and cannot see what you choose in the sheet. Direct Instagram publishing is not implemented.

## What's new in this pass

- **New visual language** in `src/ui.tsx`: dark-first palette with a light mode, mint accent, softer radii, pill chips, primary / secondary / ghost buttons, avatars, stat tiles, status pills. Below / in / above range are never red or green; they are words plus amber / mint / lavender.
- **Navigation:** original line icons, a raised Create button, themed headers and status bar (`app/_layout.tsx`, `app/(tabs)/_layout.tsx`).
- **Feed:** avatar and author hierarchy, "Fictional" / "You" pills.
- **My Glucose:** gradient-filled trace with gaps preserved, range band, stat tiles.
- **Create, rebuilt** on a new artwork engine (`src/art/`):
  - Six templates: Minimal trace, Daily recap, Transparent overlay, The real side, Shift report (humour), Milestone.
  - Tones: minimal, humorous, motivational, educational, custom, plus "Another line".
  - Day or 7-day periods, exact 1080×1920 / 1350 / 1080 exports, transparent PNG, 250 px story safe margins (110 portrait, 90 square).
  - Every number optional. A live **What's on this image** list matches the export. Demo data is always labelled on the image.
  - Text wrapping that never splits words, contrast-checked accent colours, empty-state and partial-day notes.
- Existing behaviour kept: private-by-default publishing with preview, CSV import, local reports/blocks, persistence.
- A backup of the original source is in `_backup_before_claude/` (safe to delete once you're happy).

## Where things live

| Path | What |
| --- | --- |
| `src/ui.tsx` | Design tokens (`palette`, `space`, `radius`) and primitives (`T`, `Card`, `Button`, `Input`, `Stat`, `Pill`, `Avatar`, `Mark`) |
| `src/screens/`, `src/components/`, `src/hooks/` | One file per screen, shared components, hooks |
| `src/story.ts` | Adapter from the app's data and unit names to the artwork engine; makes SVG safe for `react-native-svg` |
| `src/art/` | Artwork engine: pure TypeScript, no React Native. `templates.ts` (layouts), `svg.ts` (text fitting, chart, colour), `copy.ts` (tone lines), `formats.ts` |
| `src/art/brand.ts` | The product name in one place |
| `tests/core.test.ts` | 14 core tests including every template × format size and overflow check |

## Renaming the product

The name is a single constant in `src/art/brand.ts`; the rest of the code reads it. To rename, also change `name`, `slug` and `scheme` in `app.json`, `name` in `package.json`, and the permission strings in `app.json`. Nothing here checks trademarks.

Before you commit to **Gluca** (or any name): the name is close to many "Gluco…" health apps, so the space is crowded. Do these checks and ask a trademark attorney before launch; this README is not legal advice.

- US: search the USPTO database, https://tmsearch.uspto.gov (look in classes 9, 42, 44 and 45 for similar sounding marks, not just exact matches).
- EU/UK/others: https://www.tmdn.org/tmview/ .
- App Store and Google Play search, plus Instagram, TikTok, X and domain availability.
- Also search the unreleased-product concern you mentioned: unreleased apps rarely show up in searches, so an attorney's clearance search is the only real answer.

## Checks

```powershell
npm run typecheck      # clean
npm test               # 14 tests
npm run test:e2e       # Playwright (uses Edge); updated for the new Create screen
npx expo install --check
npx expo export --platform web
```

Typecheck and the 14 core tests passed when this pass was made. The Playwright journey was updated for the new Create flow but **was not run** (no browser in the build environment), and the app screens themselves have not been run on a device, so expect to eyeball them and tell me what to adjust.

## Known limits

- Fonts: web exports embed Inter. On phones the preview and native export use the system font, so wrapping can differ slightly from the web export. The native preview also omits the soft glow behind the trace (it is not supported by `react-native-svg`).
- Time zones: artwork treats timestamps as local wall-clock time; DST transitions are not adjusted.
- Not built: accounts, real backend, Dexcom / Apple Health / Health Connect, activity and meal logging, photo backgrounds, Wrapped. They remain roadmap items in `docs/IMPLEMENTATION_PLAN.md`.
- Educational caption lines need clinical review before real users see them.
- `npm audit` has previously reported moderate advisories in the Expo dependency chain; recheck before release.

## Data and privacy boundaries

All community identities and seed posts are fictional. Synthetic glucose is labeled. The demo stores changes in browser/device storage and uses no social server, health integration, advertising tracker or telemetry SDK. Do not import real health information: prototype AsyncStorage is unencrypted. Externally saved graphics can be copied and may be impossible to retract.

Visibility selections model the intended product flow on **one local demo account**; they are not multi-user authorization. A real backend requires RLS, authentication and cross-user tests before use. There is no registration or age-verification flow yet. Public beta is intended for adults after review. This app provides retrospective reflection, not treatment advice, glucose alarms, insulin dosing or device control.

`.env.example` reserves future public Supabase configuration; nothing is needed or consumed in demo mode. Never put a service-role key, client secret, access token or raw health information in an `EXPO_PUBLIC_*` variable, log, URL or commit.

## Analytics and time assumptions

Stored readings are mg/dL with UTC epoch timestamps. Unit conversion uses 18.0182 mg/dL per mmol/L without changing storage. Invalid readings outside 20–600 mg/dL are excluded. Duplicate timestamps use the last valid row deterministically.

Time estimates use a forward step capped at five minutes or the next reading, clipped to explicit interval boundaries. The final reading contributes at most five minutes. Unknown intervals never count as time in range. Average, SD and CV are weighted by these observed durations; range percentages use observed time as denominator, with separate total-interval coverage. This is an estimate, not interpolation or a clinical AGP implementation. The dashboard preserves missing-data gaps; no data is invented.

The dashboard's day selection uses local midnight; its 24-hour option follows the next calendar midnight, so DST days can be 23 or 25 hours. Short ranges start at midnight; multi-day ranges roll back from now. The story editor now works on a calendar day (or the 7 days ending on that day) in the person's local time, using the share-first engine in `src/art/` (same duration-weighted rules, 5-minute cap, gaps never interpolated). It treats timestamps as wall-clock time, so DST days are not adjusted.

CSV timestamps with explicit offsets retain those offsets. Local timestamps require a user-selected date order and fixed UTC offset. Split local-time files at DST transitions or provide explicit offsets per row. This does not infer an IANA timezone or all vendor/localized CSV variants. It intentionally asks for units rather than guessing.

`src/providers.ts` exposes Mock and CSV implementations plus rejecting placeholders for Dexcom, Apple Health and Health Connect. `src/analytics.ts` is pure calculation logic. `src/store.tsx` owns local community state; the files in `src/screens/` compose functional screens; `src/story.ts` produces export artwork independently of editor controls. See [integration preparation](docs/INTEGRATIONS.md) for server architecture requirements.
