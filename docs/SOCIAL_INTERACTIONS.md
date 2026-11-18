# Stage 9A — Account social interactions

Implemented in the existing application and Node/SQLite service, 18 November 2026. No new service, dependency, navigation tab, push provider or health-data store. Fictional local posts remain labelled and separate from authenticated account posts.

## Reused infrastructure

Existing HttpOnly account sessions, CSRF/Origin checks, bounded JSON requests, request throttling, encrypted storage key, migrations, post/image publication and visibility rules. Existing PostCard, identity/shield components, Page, Sheet, Button, Input, design tokens, five-tab shell, award repository and unlock feedback are reused. Create uses its original renderer and publishing route.

Before this stage, account images could be posted but account-post reactions/comments were explicitly unavailable; demo Boosts, comments, follows and blocks were local only. No server-owned social inbox existed. Those local records have not been silently uploaded or credited as real participation.

## User workflow

- Home: tap the bolt to Boost another member’s post; tap again to remove it. Open Comments to read or write. Counts come from the server. Use Refresh feed to reconcile, or resume the browser. Visible browsers refresh social metadata every 30 seconds; hidden browsers do not poll. This does not change Dexcom synchronization.
- View @username beneath an account author opens the existing public profile. Follow/Unfollow works from the card or profile. Profiles show real follower/following counts, distinct from labelled demo following. Following does not grant access to private posts.
- Comment author opens the profile. Members without a public handle have an identity/detail sheet and follow/block controls; login names are never exposed as public handles. Comments show the latest 100 entries. Authors can delete their own comments, including after a block; post owners cannot impersonate commenters or delete their comments through this endpoint.
- Public profile: Block member asks for confirmation. Blocking is mutual for access: posts, images, comments, profile lookup and notifications disappear in both directions. Mutual follows and Boosts are removed. Profile → Blocked members → Unblock removes only your block; it does not restore follows or Boosts. Comments remain hidden while blocked, and can become visible again after unblocking unless deleted.
- Home → Notifications: grouped Boost/comment/follow updates, with Mark all as read. Opening a notification reuses existing post/profile routes. No push, email, sound or automatic health-data publication. Same-person comments on the same post form one group; a genuinely new comment makes that group unread. Remove/re-add Boost/follow requests do not repeatedly notify the recipient.

## Backend contract and permissions

Every endpoint below requires the existing authenticated session; writes also require the existing CSRF header and Origin policy. Owner IDs always come from the session, never the body. Unknown/private/blocked/deleted resources return the same unavailable response. Existing private/public visibility is enforced for reads, mutations and image bytes; followers-only is still unavailable.

| Endpoint | Behavior |
| --- | --- |
| GET /api/posts?id=… | Single authorized post, including older posts opened from a notification |
| POST /api/social/boost | `{id,active}` desired state, transactional award and notification receipt |
| GET /api/social/comments?id=… | Authorized comments, public identity only, encrypted text decrypted on demand |
| POST /api/social/comments | `{id,text,requestId}`; 1–1000 characters; stable receipt for retries |
| POST /api/social/comments/delete | `{id}`; current author only, erases text, keeps retry tombstone |
| GET /api/social/member[?id=…] | Relationship and follower/following counts; defaults to current account |
| POST /api/social/follow | `{id,active}`; unique relationship, no self-follow or block bypass |
| GET /api/social/blocks | Only the current account’s block list |
| POST /api/social/block | `{id,active}`; modifies only the current account’s block |
| GET /api/social/notifications | Recipient-owned inbox, revalidates current visibility and blocks |
| POST /api/social/notifications/read | Marks only the current recipient’s groups as read |

Migration 9 adds `post_reactions`, `post_comments`, `user_follows`, `user_blocks`, `social_notifications` to the existing SQLite database. Primary/unique keys enforce one reaction per post/account, one relationship per pair, one comment per author/request receipt and one notification group per recipient/actor/kind/subject. All writes affecting multiple records run in an immediate transaction. Old migrations and user data remain intact.

Comment bodies use the existing AES-GCM vault key with `comment:v1:<author>:<comment>` authenticated context and random IV. Deleting a post erases its image/caption and attached comment text, removes reactions and related notification groups, and keeps retry tombstones. Graph identifiers, kinds and timestamps are metadata in the protected SQLite file, not encrypted end to end. Service-account filesystem restrictions, key/backup protection and HTTPS remain necessary. SQLite/backup deletion is not a claim of forensic erasure.

Public profiles now include an opaque `accountId` for relationships. Existing identity opt-ins remain authoritative; raw diagnosis dates, birthday dates, credentials and Dexcom data are not added. Notification previews contain only public name/handle, interaction kind, authorized post reference and time/read state. Never comment text, post caption, glucose values, diagnosis/device details or private medal data. Account feed/comments/inbox data stays in memory and is cleared on account session invalidation; late responses are rejected. No new analytics events or browser health persistence.

## Awards and safety

A newly inserted Boost on another account’s authorized post can create the existing private Community Boost medal (rule version 3), atomically and once. Only genuine new award IDs refresh the existing cabinet/unlock queue. Unboost/reboost, retries, followers, fictional demo taps and comment spam do not create additional medals. Direct browser `support_given`/`comment_added` award submissions are rejected. Existing awards are preserved; earlier Community Boost medals retain an explicit local-demo source description. First Post continues to require an actual new public publication; the existing contributor rules retain verified publication sources. Comments do not automatically establish that an exchange was meaningful; no volume-based comment award is added. Challenges and all health-award restrictions are preserved.

## Launch and verification on Windows

From the existing Gluca directory, using the existing backend environment (no new secrets):

```powershell
npm run typecheck
npm test
$env:EXPO_PUBLIC_FLAGS='identity,accounts,achievements,communityChallenges,eventLogging,dexcomApi,dexcomDiagnostics,dexcomSync'
$env:EXPO_NO_TELEMETRY='1'
$env:EXPO_OFFLINE='1'
npx expo export --platform web --dev --max-workers 2
npm run server
```

Restart a previously running backend to load migration 9/routes. Use two fictional Gluca accounts in separate browser profiles at the existing local origin. Publish a synthetic Public graphic from Create, Boost/comment/follow from the other account, refresh the author’s feed/inbox and verify counts. Try a Private post and a mutual block. Do not use private health content for test evidence.

```powershell
$env:E2E_BASE_URL='http://localhost:3000'
npm run test:e2e -- tests/e2e/stage9a.spec.ts --workers=1
npm run test:e2e -- --workers=1
```

Automated tests own isolated in-memory backends and synthetic accounts, images and comments. They do not mutate the owner’s account or contact the live Dexcom service. Browser coverage includes optimistic update/rollback, rapid taps, two-account notifications, comments/deletion, follow counts, block/unblock, media aspect, navigation and 375/430/1280 light/dark layouts. Existing publishing regression tests remain part of the full suite. See the verification record below for actual final results.

## Limits and later work

Web account interactions only; native account origin/cookie handoff and device gestures remain unverified. No WebSocket/push service: other clients reconcile on refresh/resume or the 30-second foreground check. Feed remains bounded to its existing latest 30 posts; comments/inbox to 100. Deep-linked authorized older posts can still open. Full comment pagination, notification preferences/dismissal, moderation delivery, anti-abuse review and production retention policies are later work. Report locally is still explicitly local, not a working moderation service.

For public deployment: production account recovery/verification, HTTPS/secure cookies and origin configuration, protected vault/database/backups with key rotation, shared/distributed throttling if scaled, moderation/block abuse handling and retention/deletion policies need an operational review. The current limiter is per-process/socket IP (120 social writes/minute); do not blindly trust forwarded headers. Public hosting and live Dexcom behavior were not newly verified by Stage 9A. No Stage 9B work.

## Changed files

Backend: `server/db.ts`, `server/routes.ts`, `server/posts.ts`, `server/profiles.ts`, `server/achievements.ts`, new `server/social-core.ts`, new `server/social.ts`.

Client: `src/types.ts`, `src/domain/profile.ts`, `src/achievements/life.ts`, `src/hooks/use-feed-posts.ts`, `src/components/boost-button.tsx`, `src/components/post-card.tsx`, `src/components/achievements/medal-sheet.tsx`, new `src/components/social-interactions.tsx`, new `src/services/social.ts`, `src/screens/home.tsx`, `src/screens/post-detail.tsx`, `src/screens/profile.tsx`.

Tests: new `tests/server-social.test.ts`, `tests/social-client.test.ts`, `tests/e2e/stage9a.spec.ts`; updated `tests/server-profiles.test.ts`, `tests/server-achievements.test.ts`. Synthetic screenshots: `docs/screenshots/stage9a/`. Documentation: this guide, `SOCIAL_REACTIONS.md`, `UI_REFINEMENT.md`, `ACHIEVEMENT_SYSTEM.md`, `PROFILE_PRIVACY.md`, `ROADMAP.md`, `PROJECT_MAP.md`, `DECISIONS.md`.


## Verification record — 18 November 2026

- `npm test`: **389/389 passed**, including additive migration preservation, Boost concurrency/uniqueness, private/deleted/blocked permissions, encrypted comments and deletion, follow counts, notification deduplication/regrouping, award idempotency, account-scope invalidation and write-rate recovery. All fixtures synthetic.
- `npm run typecheck`: passed. Targeted Prettier check: passed. No lint command/configuration exists in this repository; a lint pass is not claimed. `git diff --check`: clean after normalization.
- Full normal Edge suite: **26/26 passed**. This includes existing photo/transparent export, mobile gestures, navigation, profile/shield/onboarding, trophy cabinet, opt-in Create-to-feed publication, upload/export failures and challenges.
- Final affected-screen rerun after the medal-source text and shared-refresh adjustment: **3/3 passed** (Stage 9A's two workflows plus the existing Trophy Cabinet journey). The new support award popup opened the actual cabinet detail, whose source correctly identified a confirmed Boost. Optimistic rollback/rapid taps, comments/deletion, two-account inbox, follows and block/unblock were exercised in the browser.
- Dedicated mocked Dexcom OAuth browser journey: **1/1 passed**. Dedicated mocked Dexcom-to-Create actual PNG export: **1/1 passed**. These are mocked upstream responses, not live Dexcom verification.
- Feed, conversation and public profile captured at **375, 430 and 1280 pixels, light/dark**, with no horizontal overflow, persistent navigation, correct 1080:1350 media aspect and 44px Boost target checks. Representative generated screenshots visually reviewed; native devices and real screen-reader operation remain unverified.
- Existing local backend reloaded with its current environment/database. Health returned **200** and anonymous social inbox/block-list requests returned **401**. No owner health data or account post was read or created for this check. The migration retains all preexisting tables/data.
- Historical screenshot outputs regenerated by the regression tests were restored; only new synthetic Stage 9A evidence remains in the change set. No live Dexcom request, public deployment or Stage 9B work was performed.
