# Profile privacy — Stage 6B

Stage 7B preserves this storage and public projection architecture. Shield details explain precision without receiving a public diagnosis date. Owner-only cards may use their own private date to show a known next anniversary. No diagnosis year/month sharing permission exists, so those values remain omitted from public responses. No migration or new public medical field is introduced.

## Boundaries

Private owner data: community connection, diagnosis with its original precision, birthday month/day, age-confirmation preference, monitoring/device/model, delivery/model, interests and visibility switches. These never enter telemetry. Choosing a device is self-reporting; it does not connect Dexcom, prove ownership or confer permission to view glucose data.

Explicit public profile fields: display name and optional user-chosen handle, bio and cropped photo. Medical fields are independently off by default. `publicView()` is the single allowlist for shield/emblem, diabetes type, device/delivery and birthday celebration opt-ins. Public responses never contain diagnosis date, birthday date, age, account credentials, Dexcom connection details or glucose readings. A birthday opt-in can expose only a celebration boolean on that date, not the stored date/year. Hiding shield years still reveals its broad shield style, which the user chooses by enabling the shield.

## Existing backend, additive storage

Migration 5 appends `user_profiles(user_id,handle,payload_enc,revision,updated_at)` without replacing existing users, credentials, sessions, OAuth states, tokens, glucose tables or historical migrations. Private profile JSON and privacy choices are AES-256-GCM encrypted using the existing protected backend vault key with `profile:v1:<owner>` authenticated context and a random IV. The public handle is a plaintext unique lookup index; it is intended as public metadata. Missing encryption configuration fails closed with 503. Existing token/key operational controls still apply; encryption is not a substitute for service-account filesystem restrictions, key rotation or backup protection.

Routes reuse the existing session/CSRF/same-origin/no-store/log-redaction infrastructure:

- `GET /api/profile`: current authenticated owner only; no caller-supplied owner ID.
- `POST /api/profile`: explicit save, authenticated owner, CSRF custom header, body/schema limits, field sanitization, unique handle and revision compare-and-swap. Stale writes get 409. Unknown fields are dropped. No remote photo URLs/SVG accepted.
- `GET /api/profiles/public?username=<chosen-handle>`: authenticated lookup, returns only `publicView()`. It is a public-shaped view for community users, not an anonymous directory. No private DTO is spread into its response.

Profile photos are locally cropped/resized JPEGs bounded to 24,000 data-URI characters (roughly 18 KB). Backend encryption covers the accepted photo too. Save makes that cropped image part of the public profile; an original file is not uploaded. Public fields and opt-in shields are inherently visible to their intended viewers. No production cloud media service, face analysis or external tracker is introduced.

## Device/session behavior and legacy preservation

Authenticated profiles load into memory after the current session is verified. Login/account changes remount editors and invalidate pending profile responses/saves; logout clears the active identity rather than showing one user's medical fields under another account. Saves are explicitly committed; network errors and concurrent edits never claim success. Browser reload recovers the server-owned saved profile. Guest edits are session-only and native account-origin/handoff/device verification remains a future gate.

Cross-tab messages carry only closed event/reason enums. Account changes clear identity and glucose; provider disconnect stops glucose work without clearing the still-authenticated profile. No profile fields, owner IDs or health values travel in that channel. Photo callbacks are ignored after an editor unmounts so a pending picker cannot attach a previous account's photo to a new editor.

New account profiles are not serialized into device-wide AsyncStorage. Existing legacy local profile/privacy values are preserved unchanged there, rather than silently uploaded or destructively deleted. They are still an older plaintext privacy limitation: do not describe that legacy store as encrypted. **Review previous local profile** is explicit, resets public medical switches off and requires review/save before account persistence. Existing social posts/preferences and manually approved snapshots remain the local fictional prototype; this stage does not implement backend social ownership, a follower directory or new member systems.

The existing glucose/token privacy architecture is unchanged. No raw glucose server persistence, private CGM analytics events, automatic publication, supporter access delegation or forced Dexcom connection was added.

## Release gates

This remains a development account system. Before public use: verified identity/recovery/MFA policy, a defined minimum-age policy independent of birthdays, stable TLS origin/cookie configuration, vault ACL/key/backups/restore review, native account handoff and physical-device photo/storage testing, moderation/username policy, real social ownership/permissions, retention/deletion/export policy and regulatory/privacy review. No deployment or compliance claim is made. Existing dependency advisories still require review; the single added package is SDK-compatible `expo-image-manipulator`, used for local photo reduction rather than a cloud image service.


## Stage 9A addition — 2026-11-18

Public-shaped authenticated profile responses now include an opaque accountId for real follow/block relationships. This is not the account login name or a credential. Existing publicView medical opt-ins and private-date exclusions remain unchanged. Mutual blocks now protect public-profile lookup, feed posts, image bytes, comments and notifications. Follower/following counts do not grant access to private posts. Notification actors are reduced further to name/handle only. See SOCIAL_INTERACTIONS.md for migration 9, encrypted comment storage, account-session invalidation and deletion/retention limitations. The older local-only social description above is historical; fictional demo records remain separate and are not uploaded.


## Stage 9B — Community membership and discovery (2026-11-18)

Recommendations are computed locally from the current owner's voluntary identity/device/interests fields. No recommendation reasons, diagnosis dates, treatment methods, device details or raw glucose are sent to another user, a community moderator, a recommendation API or analytics. Missing/prefer-not-to-say fields are not inferred. Suggestions do not join groups and do not indicate Dexcom authorization. Manual browsing remains available.

Real account memberships use migration 10 in the existing protected backend. Default is private. Listing on public profiles, member directories and counts requires BOTH per-community visibility and Settings → Display community memberships. Counts explicitly include public memberships only, never a hidden-member total. Mutual blocks and membership restrictions remove public identities from the viewer's list/count. Member cards omit medical/device/treatment/birthday data; moderators have no hidden member directory. Membership and report graph identifiers/times are relational metadata in the protected SQLite file, not end-to-end encrypted; server/backup access controls remain essential.

Community posts use an additional member-only authorization condition in the existing post/image/comment/Boost routes. Following does not grant access. A Private post cannot be widened by a community association. Joining grants no Dexcom access and no raw glucose history. Posting explicitly discloses participation even if membership listing is private; the composer/export destination warns before publishing. Leaving revokes others' posts, images, comments and notification previews. Previously shared content is not deleted by leaving; own post/comment deletion remains available. Public generic-feed and community audiences remain distinct.

Reports accept enum concerns only, without free-text private health details. Community moderators require operator-provisioned permissions and active membership; no self-service role changes or private profile access. Report-review responses omit reporter identity, comment text, images and private membership data. Operational reviewer provisioning, appeals, retention and production moderation remain open. See COMMUNITY_SYSTEM.md and COMMUNITY_DISCOVERY.md for the complete contract, tests and limits. No native, clinical-reliability or production-security claim is made.


Stage 9B verification (2026-11-18): 398 core tests, 29 full Edge tests, four final affected-screen checks and both dedicated mocked Dexcom journeys passed. Typecheck/formatting checks passed. Responsive light/dark evidence is synthetic. No live Dexcom or native-device verification. Full results and moderation/production limitations: COMMUNITY_SYSTEM.md. Stop after Stage 9B.
