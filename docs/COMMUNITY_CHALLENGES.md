# Community Challenges - Stage 8B

Open **Community/Home -> Discover Challenges** or **Explore -> Explore Challenges**. The existing five primary tabs are unchanged; /challenges belongs to Explore. Available, Joined and Completed views use the shared Page/Card/Chip/Sheet components, original Gluca SVG glyph illustrations, existing Medal art and Trophy Cabinet. There is no separate reward system or new backend.

## Five initial challenges

| Challenge                                                    | Completion                                                                                                                                                                                                                                  | Associated medal     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Share a Moment (`share_moment`)                              | A new Public post committed through the existing authenticated Create-to-feed workflow after enrollment. Private posts, exports, old posts and upload retries do not count.                                                                 | First Post           |
| Get Moving (`activity_of_choice`)                            | Explicit confirmation of a completed activity, or a new activity saved through the existing Log link opened from the enrollment. Both are self-reported. No duration, intensity, calories, pace or glucose requirement.                     | First Activity       |
| Spread Awareness (`awareness_event`)                         | Explicit confirmation of taking part in an awareness activity; no evidence/name/date required.                                                                                                                                              | Awareness            |
| Make a Connection (`helpful_experience`, retained legacy ID) | Two explicit confirmations: joined an existing community outside Gluca, and had a meaningful exchange. Gluca's current communities are demos, so demo joins/Boosts never automatically qualify. No group name or conversation is collected. | Community Connection |
| Celebrate a Milestone (`personal_milestone`)                 | Explicit private confirmation of a meaningful event; no medical details, date or publication required.                                                                                                                                      | Personal Milestone   |

Supporters and people living with diabetes are equally eligible; Dexcom is not required. Share a Moment can use the existing glucose-free Milestone template for a photo or personal update. The challenge opens Create but never pre-enables posting or selects Public for the person. Actual publication still requires image/audience confirmation. No plain-text posting service was added.

## Registry and persistence

The existing `src/achievements/challenges.ts` registry is extended rather than duplicated. Entries contain ID/title/description, artwork reference, all-account eligibility, completion criterion, associated medal, private visibility, once-only repeatability, rule version, nullable UTC start/end instants, disabled switch and communityChallenges flag. The five initial challenges have no deadlines. Date windows are start-inclusive/end-exclusive, enforced by the backend. Repeatable/seasonal challenge histories would need a separately reviewed extension; none are pretended here.

Additive migration 8 creates `challenge_participation`, keyed by (user_id, challenge_id) with a user foreign key. Definitions remain in code. Each private payload is AES-256-GCM encrypted using the existing protected backend key and owner/challenge authenticated context. It stores only enrollment ID, joined/left/completed state and times, rule version, completion-source enum, opaque receipt/award ID and generic outside-community marker. No diagnosis, glucose values, activity notes, duration, messages or group names are included. SQL owner/catalog identifiers remain restricted backend metadata; this is not a claim of whole-database encryption.

`GET/POST /api/challenges` reuse authenticated HttpOnly sessions, CSRF header/Origin checks, request-body limits and write rate limiting. Request-supplied owner IDs are not trusted. There is no public participation endpoint, roster, participant count or public completion projection. Registry visibility and server writes support Private only; Public participation is rejected. Medal visibility/pinning remains independently opt-in through the existing cabinet and never reveals enrollment details.

Join is idempotent while already joined. Leave is reversible and does not remove an earned medal. Rejoining after leaving creates a fresh opaque enrollment ID. Stale completion/leave requests cannot affect that new enrollment. Completed once-only challenges remain completed; repeated requests cannot create new awards. A completed challenge is not reset or penalized for inactivity.

## Event and medal integration

New Public posts call the challenge transition inside the existing post transaction, after the owned image/post and First Post award are created. Only the NEW-post branch runs it; a retried historical upload cannot backfill enrollment. Completion and associated award persistence share the same SQLite transaction. Self-reported completions use the existing applyEvent/loadCabinet/saveCabinet path. The new Community Connection definition is nonmedical and flagged; health rules stay disabled.

Medals already earned elsewhere are reused, not re-awarded. Details explicitly identify the associated medal; a prior award's original date is preserved. Existing Trophy Cabinet Personal moments can still earn private medals independently, without silently enrolling a person in challenges. Old demo/local challenge counters are not imported into account participation.

The existing unlock queue receives only server-confirmed newly created award IDs. Initial reads/reloads and completion replays remain silent. A session-scoped announced-ID set prevents a fast refresh or parallel activity receipt from announcing the same medal twice. Existing reduced-motion behavior and reserved feedback area are reused; Create defers feedback until editing ends.

Client participation is memory-only. Session transitions clear rows, consent switches, detail sheets and pending work; late responses are ignored by account scope. Source API failures are not presented as completion. Reload before retrying an uncertain result; server completion is idempotent. There is no durable offline enrollment queue. The optional activity Log sends only the enrollment-bound confirmation after saving an Activity. If that network step fails, enrollment stays Joined and the user can reload/explicitly confirm from Challenges; the local activity remains saved.

## Windows setup

No new dependency, credential or service is required. Retain the existing backend-only .env keys. From the existing project root:

```powershell
$env:EXPO_PUBLIC_FLAGS='identity,accounts,achievements,communityChallenges,eventLogging,dexcomApi,dexcomDiagnostics,dexcomSync'
$env:EXPO_NO_TELEMETRY='1'
$env:EXPO_OFFLINE='1'
npx expo export --platform web --dev --max-workers 2
npm run server
```

Stop/reload the existing backend first; do not start a duplicate on port 3000. Open http://localhost:3000/challenges after signing in. communityChallenges is an opt-in client discovery flag, consistent with existing app flags, not an authorization boundary. Server authentication, private ownership, registry availability and disabled checks apply to direct API requests too. Set disabled on a definition to stop new participation/completion without erasing previous history. Achievements must also be enabled to display cabinet/unlock UI. eventLogging enables only the optional existing logger; direct activity confirmation needs no tracker.

```powershell
npm run typecheck
npm test
$env:E2E_BASE_URL='http://localhost:3000'
npx playwright test tests/e2e/stage8b.spec.ts --workers 1
```

## Safety and current limits

No glucose/A1C outcomes, insulin/food restriction, medical competitions, exercise targets, punitive streaks, public standings or spam-based interaction counts. No medical information is required. Only the explicitly chosen Share a Moment Public post leaves private participation; other challenges can complete privately. Make a Connection is self-reported outside-community participation because live Gluca group interactions/membership verification do not exist yet. No live groups, messages or reactions were fabricated.

Durable account enrollment is supported in the existing web account architecture. Native account handoff/device accessibility remain gated; native can browse the catalog but should not be described as having verified account persistence. Physical mobile/screen-reader testing, production authentication/recovery/retention/moderation and future repeatability remain open. No public deployment, extra social service, Dexcom feature or raw-health database was introduced. Creative note for Claude: future artwork refinements should extend the existing original glyph/medal language, preserve accessible contrast/equal emphasis, and avoid status or rarity styling.

## Verification - 18 November 2026

- TypeScript clean; 380 core tests pass. New tests cover registry/date windows, explicit enrollment, leave/rejoin, stale enrollment IDs, duplicate completion/awards, encrypted persistence, owner isolation, private-only visibility, unsupported criteria/conditions and new-public-post integration. Existing 376 tests remain passing.
- 24 normal browser cases pass across the broad regression run and targeted rerun. The broad run passed 23; the old screen audit sent Escape before the modal became active. The test now waits for the named active dialog (the point at which React Native Web registers Escape/focus behavior). Its complete 66-layout audit and all three new challenge journeys passed in the final four-case run. No application modal behavior was changed to mask the timing issue.
- Two separate mocked Dexcom OAuth and historical data-to-Create journeys pass. This is not a new live sandbox verification.
- Actual browser workflows prove supporter enrollment/leave, four private completions including the existing activity logger, source labels, associated medal details and pinning, no replay popup on reload, logout isolation, and a glucose-free Create -> private post (no completion) -> Public post (completion) -> existing feed path.
- Catalog/detail layouts were tested at 375/430/1280px, light/dark, with 18 fictional screenshots under docs/screenshots/stage8b. No horizontal overflow; detail Close stays reachable; five primary tabs remain. Reduced motion was emulated. Cabinet/unlock feedback was exercised. Physical phone/screen-reader behavior is not claimed.
- Development web export and targeted Prettier/whitespace checks pass. No lint script/configuration is provided by the repository; no new lint dependency was installed.
- Historical screenshots regenerated by regressions were restored. All fixture users/images/events are fictional; no owner enrollment, public post or outside-community action was created by the agent.

The existing local backend was reloaded with the new routes/migration. Refresh Gluca; sign in if requested. No further stage is started.

## Changed files

- `AGENTS.md`
- `README.md`
- `app/_layout.tsx`
- `app/challenges.tsx`
- `docs/ACHIEVEMENT_SAFETY.md`
- `docs/ACHIEVEMENT_SYSTEM.md`
- `docs/COMMUNITY_CHALLENGES.md`
- `docs/DECISIONS.md`
- `docs/PROJECT_MAP.md`
- `docs/ROADMAP.md`
- `server/achievements.ts`
- `server/challenges.ts`
- `server/db.ts`
- `server/posts.ts`
- `server/routes.ts`
- `server/static.ts`
- `src/achievements/challenges.ts`
- `src/achievements/events.ts`
- `src/achievements/life.ts`
- `src/components/achievements/challenge-artwork.tsx`
- `src/components/achievements/medal-sheet.tsx`
- `src/flags.ts`
- `src/hooks/use-achievements.ts`
- `src/hooks/use-community-challenges.ts`
- `src/nav.ts`
- `src/screens/challenges.tsx`
- `src/screens/explore.tsx`
- `src/screens/home.tsx`
- `src/screens/log.tsx`
- `src/services/community-challenges.ts`
- `tests/achievement-life.test.ts`
- `tests/community-challenges.test.ts`
- `tests/e2e/stage7c.spec.ts`
- `tests/e2e/stage8b.spec.ts`
- `tests/server-challenges.test.ts`

Evidence: `docs/screenshots/stage8b/`. No dependency, credential file, glucose calculation/provider or identity-shield artwork changed.
