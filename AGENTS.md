# AGENTS.md — start here

You are picking up **Gluca**, a mobile-first app that helps people with diabetes turn their own glucose data into graphics they choose to share, with a local social prototype around it. This file is the entry point for any agent or developer with no prior context. Read it fully before changing anything.

Project root on the owner's Windows computer:
`C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca`

All paths in these docs are relative to that root.

## Read in this order

1. `AGENTS.md` (this file): rules, commands, how to work.
2. `docs/PROJECT_MAP.md`: every folder and file, what it does, how data flows, known problems.
3. `docs/ROADMAP.md`: the remaining work as ordered milestones, each with a full specification and acceptance criteria.
4. `docs/SKILLS.md`: which skills and outside expertise fit each milestone.
5. `docs/DECISIONS.md`: decisions already made, and decisions only the owner can make.
6. `README.md`: how to run the app and try it on a phone.

## Current state in one paragraph

Expo SDK 58 / React Native 0.88 / Expo Router / strict TypeScript app with five tabs (Home, My Glucose, Create, Explore, Profile) plus Settings, Import and Post detail. Everything is local: fictional community, synthetic glucose, AsyncStorage, no backend, no accounts. A visual pass restyled the UI and rebuilt the Create screen on a tested artwork engine (`src/art/`) with six templates and exact-size PNG exports. `npm run typecheck` is clean and `npm test` passes (121 tests as of M11). M0 to M6 and M8 (flagged off) are done on web (2026-11-14): every route runs clean in a browser, the Playwright journey passes and the folder is a git repository. **Nothing has been run on a real phone yet** (M7).

## Rules that never change

These come from the owner's briefs. A change that breaks one is wrong even if it works.

**Privacy**
- Glucose files are parsed on the device. Never upload raw readings.
- No account is needed to make a graphic locally.
- Analytics may never contain glucose values, file names, captions, free text or identifiers. `src/art/telemetry.ts` enforces a closed set of enum properties; keep it that way. Analytics stay off or local-only until the owner approves a provider.
- Never auto-publish. Show exactly what an export contains (the "What's on this image" list must match the image).
- Provide a clear way to remove imported data.
- Never commit secrets or real health data. Sample data must be synthetic.

**Safety and tone**
- Gluca is not a medical device. No dosing, treatment or diagnostic advice. No HIPAA or regulatory claims.
- Never imply a person's worth depends on a glucose number. No rankings, grades, leaderboards or streak guilt.
- Below / in / above range are never coded red or green. Use words plus the amber / mint / lavender tokens.
- Humour must never encourage unsafe glucose management.
- Demo data is always labelled on the image. That label cannot be switched off.
- Missing data is drawn as a gap and never interpolated or counted as in range.

**Honesty**
- A share sheet opening is not a post. Never say something was posted or published to a social app.
- Do not present unbuilt features as working. Hide unfinished work behind a flag.
- Do not copy another product's branding or layouts (the owner's Strava screenshots were inspiration only).

**Needs the owner's explicit approval first**
- Deploying anything publicly, creating paid services, connecting real health data, adding any network call, adding an analytics provider, changing the product name.

## Commands

Run from the project root in PowerShell. Node 22.13+ (or 24.3+ / 26+).

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run web` | Run in the browser at `http://localhost:8081` |
| `npm start` | Dev server with QR code for a phone (see `README.md`) |
| `npm run typecheck` | `tsc --noEmit`; must be clean |
| `npm test` | Core tests via `tools/test.cjs`; must pass |
| `npm run test:e2e` | Playwright journey in Microsoft Edge against port 8081. Set `E2E_BASE_URL` to use an already-running server on another port |
| `npx expo install --check` | Check dependency versions against the SDK |
| `npx expo export --platform web` | Production web bundle into `dist/` |

**Test runner:** `tools/test.cjs` transpiles every plain `.ts` file under `src/` and runs every `tests/*.test.ts`. New files are picked up automatically. Files containing JSX (`.tsx`) or importing `react-native` cannot be loaded by this runner; keep logic you want to test in plain `.ts`.

## How to work

1. Pick the lowest-numbered milestone in `docs/ROADMAP.md` that is not marked done. Do not skip ahead unless the roadmap says milestones are independent.
2. Read the files listed in that milestone before editing.
3. Make the smallest change that meets the acceptance criteria. Do not restructure unrelated code.
4. Verify with the commands the milestone lists, and look at the result (screenshots at 375, 430 and 1280 px wide for UI work).
5. Update `docs/ROADMAP.md` (tick the milestone, add a dated note of what was verified and what was not) and `docs/PROJECT_MAP.md` if paths changed. Record any decision in `docs/DECISIONS.md`.
6. Report plainly: what changed, what was verified, what was not.

## Definition of done for any change

- `npm run typecheck` clean and `npm test` passing.
- New logic has a test in `tests/`.
- UI changes checked at 375, 430 and 1280 px, dark and light, with no horizontal scroll and touch targets of at least 44 px.
- Every interactive element has an accessible label; colour is never the only signal.
- No new dependency without a reason written in `docs/DECISIONS.md`. Use `npx expo install <pkg>` so versions match the SDK.
- Docs updated.

## Conventions

- TypeScript strict. No `any` unless unavoidable and commented.
- Route files in `app/` only re-export a screen. Screens, components and logic live in `src/`.
- Style with the tokens and primitives in `src/ui.tsx` (`palette`, `space`, `radius`, `T`, `Card`, `Button`, `Input`, `Stat`, `Pill`, `Avatar`, `Mark`). Do not hardcode colours in screens.
- The product name comes from `src/art/brand.ts`. Do not type the name into screens.
- `src/art/` is pure TypeScript with no React Native import. Keep it that way so it stays testable and portable.
- Glucose is stored in mg/dL. Convert only for display (18.0182 mg/dL per mmol/L).
- Formatting: Prettier defaults (`npx prettier --write <file>`).
