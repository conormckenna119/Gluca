# Account communities — Stage 9B

Gluca now supports explicit account-backed communities in the existing Explore area. No sixth primary tab, new backend, messaging service or database replacement. Existing local demo clubs remain behind **Explore fictional demo**; their memberships are not uploaded, converted into real enrollments or counted as genuine participation.

## Communities and navigation

Twelve configured communities: Dexcom G7, Tandem, Omnipod, twiist, Libre, multiple daily injections, newly diagnosed with T1D, long-term diabetes, running/fitness, caregivers/supporters, parents/caregivers and awareness/advocacy. Device/experience names express a topic, not verified medical eligibility. Supporters can browse and join any community; Dexcom authorization is never required.

Explore → Discover supports search, Devices/Experience/Activity/Support categories, owner-only suggestions and My communities. Community cards open `/community/<id>`. The detail page provides information, explicit Join/Leave, membership visibility, a public member list, member feed and reporting. Profile shows the owner's actual memberships, separately from legacy demo clubs. A public profile lists only memberships the owner explicitly made public. Existing Challenges remain accessible.

The catalogue is configured in `src/domain/community-discovery.ts`, reusing stable IDs and definitions from `src/domain/communities.ts`. Additional groups require configuration, not separate screens. New definitions need a unique ID, name, description and category; existing IDs must not be repurposed. No group creation/editing endpoint is exposed to ordinary users.

## Membership privacy

Joining requires a user action and defaults to private. Idempotent duplicate joins preserve visibility and enrollment date. Leaving clears visibility; rejoining is private again. Membership ownership always comes from the authenticated session, never a submitted user ID.

Public visibility requires **both**:

1. The community's **List this membership publicly** switch.
2. Existing Settings → **Display community memberships** privacy setting.

This rule applies to the member list, profile display and member counts. Counts explicitly say **public members** and exclude hidden, blocked and restricted memberships. They do not reveal a hidden-membership total. Moderators receive no private member directory. Public member cards contain only name/handle/photo and separately opted-in identity shields/emblems; no raw diagnosis date, device, treatment, birthday or private interests.

Publishing identifies the author as a participant, even if membership listing is private. The composer and Story Studio destination explain this before publication. Group membership must never be treated as proof that a person has a diagnosis, uses a device or follows a treatment.

## Posts, images and social access

The existing `/api/posts` publisher, encrypted post/image storage, PostCard, comments, Boosts and profiles are reused. No parallel publishing table or renderer.

- Community posting requires an active, unrestricted membership, checked again inside the publication transaction. Supported content is text, photographs and the existing generated Story Studio PNGs.
- Audience is **Community members**. The legacy SQL visibility column retains `public` for this type of publication, but `community_id` imposes an additional mandatory restriction. This is not a Public general-feed post. The UI never offers followers-only access.
- Direct post, image, comment and Boost routes enforce community membership as well as existing visibility and mutual blocks. Following someone does not grant community access. A Private post cannot become readable merely because a community ID is associated with it.
- The main feed can show joined-community posts, clearly labelled with their community audience. Outsiders receive neither those posts nor their image bytes. Community feed lists require membership.
- Leaving/restriction revokes other members' posts, images and interactions. The author can still view and delete their own existing post, but cannot keep reading community comments, receiving community interaction previews or writing new comments after leaving. Own-comment deletion remains possible.
- Leaving does not erase previously shared posts/comments. Users must delete those explicitly. Previously saved external image copies cannot be recalled. Account data stays out of device-wide legacy demo persistence.
- Post receipts remain unique by account/request ID. Retries reuse the exact pending body; conflicting content returns 409. Both composer and existing exporter guard repeated taps. An uncertain outcome is described as unconfirmed, not falsely failed or successfully published.

Photographs reuse the existing system picker and `exportImage` canvas pipeline, without initiating a download. A 1080×1350 preview/export uses the existing centered cover crop. The caption/optional image description are explicit user inputs. Canonical PNG rendering strips original image metadata; the backend retains its existing bounded PNG validation. Story publishing uses the original renderer and confirmation flow. **Also post to Gluca remains off by default**, even when opened from a community. A joined-community destination can also be selected in Create; the general Private/Public audience is restored only by explicitly selecting Use general feed.

## Backend and migration

Additive migration **10** adds:

- `community_memberships`: unique `(community_id,user_id)`, active/private visibility/restriction state and join timestamp.
- `community_moderators`: unique operator-provisioned community/account permissions.
- `community_reports`: deduplicated reporter/kind/target receipts, enum reason and timestamp.
- Nullable `community_id`/`moderated_at` columns on existing `feed_posts`, and `moderated_at` on existing `post_comments`.

Existing tables, credentials, encrypted profile/token/cabinet data, historical posts and migration history are preserved. Comment and image encryption remains the existing AES-GCM implementation. Relational membership/report identifiers and timestamps are metadata in the protected SQLite file, not end-to-end encrypted. Deployment requires protected service-account permissions, vault keys, disks and backups; do not describe all database metadata as encrypted.

| Route | Permission and behavior |
| --- | --- |
| GET `/api/communities` | Authenticated catalogue with the current account's own membership flags and public counts |
| POST `/api/communities/membership` | Session-owned `{id,action:join/leave/visibility,visible?}`; restricted accounts cannot rejoin |
| GET `/api/communities/members?id=…` | Authenticated; first 50 explicitly public, unblocked identities; public count only |
| GET `/api/posts?communityId=…` | Active community membership; latest 30 authorized posts |
| POST `/api/posts` | Existing publisher with optional communityId; membership and audience validation, stable request receipts |
| POST `/api/communities/report` | Authorized community/post/comment target; enum reason only; deduplicated receipt |
| GET `/api/communities/reports?id=…` | Active member with operator-provisioned moderator permission for that community |
| POST `/api/communities/moderate` | Same community-specific moderator permission; only hide_post, hide_comment or restrict_member |

All routes require existing Gluca authentication. Writes require the existing custom CSRF header/Origin policy. Community writes use the existing limiter (60/minute per socket IP/process). Client responses are session scoped; logout/account changes clear membership/member-list/composer state and reject late responses. Provider disconnect does not silently join, leave or expose communities.

## Safety, reporting and moderation

Community discussions are shared experiences, not medical guidance. A group, shield, medal, Boost or moderator role does not verify clinical expertise. No medical leaderboards, glucose challenges, chat, new reaction kinds or new health-derived awards were added.

Community, post and comment reports accept only Spam, Harassment, Privacy concern, Unsafe advice or Other concern. No free-text health details are collected in reports. Reporter identity, private membership lists, medical profiles, image pixels and comment text are not returned by the report-review route. Reporting records a protected receipt; it does not claim immediate human review or certify content reliability. Users can also use existing mutual blocks.

Moderator permissions are **not** assigned to the first registrant, accepted from a request body or exposed through a self-service role endpoint. A trusted operator must review/provision `community_moderators` in the existing protected database. Review APIs are scoped to that community and require active membership. Moderators can hide a community post/comment or restrict an account from joining/posting; they cannot edit anyone's content or private profile, manage other communities, list private members or restrict another moderator through the API. Restriction returns no indication of whether a hidden membership previously existed. Hidden content is excluded from other members' feeds, direct image reads, comments/counts and notification previews. Its author can still delete it.

These are basic review hooks, not a staffed moderation system. Reviewer provisioning, an operator review UI, escalation/appeal/unrestriction procedures, audit retention and abuse handling need operational work before public deployment. Reports on ordinary non-community posts are recorded, but no global reviewer UI/service was added.

## Challenges and achievements

Existing challenges, Trophy Cabinet and private award storage remain. A genuine member Boost reuses the existing idempotent Community Boost event. Joins, inferred recommendations, repeated taps and comment volume do not automatically establish a meaningful exchange or grant a medal. Make a Connection retains its explicit outside-community confirmation. Member-restricted posts do not automatically count as Public general-feed publication for First Post/Share a Moment. Existing public publication and export events still work; no backlog or fictional awards are granted.

## Run and verify

Use the existing backend environment; **no new secrets or services**:

```powershell
Set-Location 'C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca'
npm run typecheck
npm test
$env:EXPO_PUBLIC_FLAGS='identity,accounts,achievements,communityChallenges,eventLogging,dexcomApi,dexcomDiagnostics,dexcomSync'
$env:EXPO_NO_TELEMETRY='1'
$env:EXPO_OFFLINE='1'
npx expo export --platform web --dev --max-workers 2
npm run server
```

Restart an already-running backend to load migration 10 and the new routes. Open the existing local origin, then Explore → Discover. Testing with two fictional accounts in separate browser contexts is recommended; no actual glucose data is necessary.

```powershell
$env:E2E_BASE_URL='http://localhost:3000'
npm run test:e2e -- tests/e2e/stage9b.spec.ts --workers=1
npm run test:e2e -- --workers=1
```

The tests use isolated in-memory databases, fictional accounts and synthetic images/comments. They do not publish to the owner's feed or access live Dexcom. See the verification record below and `COMMUNITY_DISCOVERY.md` for recommendation details.

## Limits

Account community features are web-only and use existing accounts/clubs flags. Native account/cookie handoff, hardware gestures, screen-reader operation and public hosting are unverified. Counts/lists are privacy filtered, not a total community population. Feeds show 30 posts, member lists 50 public identities and moderator report review 100 receipts; pagination, richer moderation tools, report resolution and notifications preferences remain future work. Current request limits and SQLite are for one backend process; multi-instance deployment needs shared limits and an operational authorization/storage review. No live Dexcom connection was newly verified in Stage 9B. Stop before any later stage.

## Changed files

New: `src/domain/community-discovery.ts`, `src/components/community-discovery.tsx`, `src/components/community-report.tsx`, `src/components/create/community-target.tsx`, `src/screens/community.tsx`, `app/community/[id].tsx`, `server/community-access.ts`, `server/communities.ts`, `tests/community-discovery.test.ts`, `tests/server-communities.test.ts`, `tests/e2e/stage9b.spec.ts`.

Extended: existing DB/routes/posts/social/profile/achievement/challenge/static modules; Page, Explore, Profile, Create, onboarding suggestion preview, PostCard, BoostButton, shared social-resource hook/transport, publisher/export pipeline, navigation and Post type. Existing migration and fictional-profile browser tests were updated for the new schema/explicit demo disclosure. Documentation includes this guide, `COMMUNITY_DISCOVERY.md`, `PROFILE_PRIVACY.md`, `COMMUNITY_CHALLENGES.md`, `ROADMAP.md`, `PROJECT_MAP.md`, `DECISIONS.md` and the current status in `AGENTS.md`. Synthetic visual evidence lives under `docs/screenshots/stage9b/`.


## Verification record — 18 November 2026

- `npm test`: **398/398 passed**. Includes configured catalogue/search, explicit and missing/prefer-not-to-say profile rules, supporter eligibility, date precision, private join defaults, duplicate prevention, two visibility gates, member-only text/image/feed access, Private-audience defense, blocks, leaving/restriction, reporting/moderator scope, notification filtering and existing migration/data preservation.
- `npm run typecheck`: passed. Targeted Prettier checks passed. No lint script/configuration exists; a lint pass is not claimed. `git diff HEAD --check` was clean.
- Full normal Edge suite: **29/29 passed**, including previous Story Studio photo/alpha/drag/pinch/export, onboarding/identity shields, publishing/retry/privacy, Boost/comment/follow/inbox and challenge/cabinet workflows.
- Final affected-screen rerun: **4/4 passed** after the Private-post safeguard, truthful account labels/settings link and shared onboarding recommendation preview. These covered existing supporter/caregiver/advocate onboarding plus all three Stage 9B workflows.
- Actual browser publishing used synthetic text, a chosen photo converted through the existing renderer and an exported story PNG. Repeated taps produced one post. The PNG served to an authorized member matched the downloaded export byte for byte. Another account joined explicitly, Boosted/commented/reported, left, then received 404 for the image. This was an actual local application/API/image workflow, not a mocked publishing assertion.
- Dedicated mocked Dexcom OAuth browser journey: **1/1 passed**. Dedicated mocked Dexcom-to-Create PNG export journey: **1/1 passed**. No live Dexcom request or new real-user authorization was performed.
- Discover and community detail were exercised at **375, 430 and 1280px in light/dark**, with 12 synthetic screenshots, no horizontal overflow, 44px+ join controls, named sheets and the persistent five-tab shell. Representative rendered screenshots were visually inspected. Native hardware and real screen-reader operation remain unverified.
- Existing local backend was reloaded with its existing environment/database. Health returned **200**; anonymous catalogue/member-directory/moderation-review requests returned **401**. No owner's health data, membership, feed post or moderator account was created/read for this check. Migration 10 is additive.
- Historical screenshot artifacts regenerated by regressions were restored; only new Stage 9B visual evidence belongs to this change. No public deployment, chat, leaderboard, medical challenge or later-stage work.
