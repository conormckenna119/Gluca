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
