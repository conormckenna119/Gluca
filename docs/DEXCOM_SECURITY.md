# Dexcom security — Stage 5

Scope: development-only official Dexcom V3 sandbox. The existing Node backend and encrypted token vault remain the only OAuth authority. This is not a production-readiness or regulatory claim.

## Tokens and connection ownership

- Client secret, session secret and encryption keys stay in backend-only, Git-ignored `.env`; examples contain placeholders. No new public credential variables.
- Authenticated connection/status/range/EGV/disconnect routes use the requesting Gluca session's owner. OAuth state remains random, single-use, expiring and session-bound. Callback/code exchange is server-side.
- Existing AES-GCM token encryption binds ciphertext to owner/connection metadata. Refresh uses existing leases, atomic compare-and-swap rotation, expiry, revoked authorization and rate-limit handling. Unknown refresh outcomes require safe recovery rather than reusing an uncertain rotated token.
- Browser requests carry HttpOnly session cookies, never Dexcom tokens. Private responses remain no-store; callback/query bodies, token payloads and glucose measurements are not logged. Live verification prints only aggregate evidence.
- New status cacheScope is an HMAC of session/connection metadata, not a bearer credential. Status rechecks session validity after refresh and provides a maximum 15-minute cache lease. Connection revision changes invalidate old private data. Backend never trusts a client-provided owner ID.

## Local health data

Web uses ephemeral memory; raw Dexcom/CSV history is excluded from persisted demo state and React Query caches. Legacy plaintext CSV history is removed with a visible notice; preferences, original files and explicitly approved posts are preserved. No permanent server EGV writes are introduced. Cache deletion, logout and disconnect invalidate active data and in-flight work; cross-tab messages contain only lock/check/purge enums. No glucose analytics or public sharing is added.

The SQLCipher native adapter stores its key in device SecureStore and large snapshots in encrypted SQLite, with versioned atomic writes. Missing cipher support fails closed before schema creation. Android backup is disabled; iOS key is this-device-only. Native OAuth/build/device verification remains a release gate. Unit tests simulate cipher capability and cannot establish real on-device encryption. Logical deletion is not secure physical erasure; loss of the device key prevents recovery. Uninstall/reinstall and OS backup/keychain behavior must be tested on each target platform.

Offline use is bounded by session lease, not permanent authentication. A reload has no browser history to restore; new session verification is mandatory. Same-origin XSS, compromised devices/extensions and user-selected export files remain risks even with encryption at rest. IndexedDB alone is not encryption; persisting its key beside ciphertext is insufficient. No durable browser store or optional cloud backup is enabled.

## Current development configuration and deployment gates

Use [GLUCOSE_SYNC.md](GLUCOSE_SYNC.md) for exact launch/test commands and current live sandbox evidence; [OAUTH_SETUP.md](OAUTH_SETUP.md) for callback/tunnel/secret setup. Development redirect is `http://localhost:3000/api/dexcom/callback`. Public HTTPS deployment must use an actually owned origin and exact portal registration; no deployment or new account was created.

Before public/real-user use: implement verified account identity/recovery and native browser handoff; verify SQLCipher on physical devices; review token-vault filesystem ACLs, service-account isolation, key rotation/backups/restore and ingress query redaction; retain strict CSP and secure cookies; review Dexcom access/terms/region and health-data privacy obligations; establish distributed rate limits and locks if scaling beyond one Node instance. The current prototype social identity/preferences remain local demo state, separate from backend authentication.

Dependency audit during this stage reported **28 moderate, 0 high, 0 critical** advisories across the installed tree, including Expo/minimatch paths. This is a production gate, not a clean-audit claim. No forced SDK upgrade or unrelated refactor was performed. Added Expo-compatible dependencies are expo-sqlite (large encrypted native cache), expo-secure-store (key only), expo-crypto (random key); no unofficial Dexcom SDK, second backend or server health database.

Official references: [Dexcom endpoint limits/delay](https://developer.dexcom.com/docs/dexcomv3/endpoint-overview), [Expo SQLCipher](https://docs.expo.dev/versions/latest/sdk/sqlite/), [SecureStore limits](https://docs.expo.dev/versions/latest/sdk/securestore/), [IndexedDB security/capabilities](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). Dexcom documents a maximum 30-day query and 60,000 requests per application per hour; mobile API data is delayed (documented US delay about one hour), never glucose alarms or real-time treatment data. Existing stricter relay limits remain in place.
