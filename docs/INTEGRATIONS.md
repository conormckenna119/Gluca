# Integration preparation

No real integration is implemented or connected. `PlannedProvider` rejects requests rather than returning fabricated data. Mock and CSV providers implement the same read interface; TanStack Query owns async loading.

## Dexcom

Official entry point: https://developer.dexcom.com/ (checked November 12, 2026; the public page requires JavaScript). Before implementation, verify current OAuth endpoints, API version, regional program access, delay, rate limits, sandbox behavior and production approval with the official program. These details have not been validated in this prototype.

The next implementation must keep the client secret and refresh/access tokens on a server, use official consent and server callbacks with state verification, isolate sandbox and production, deduplicate normalized readings and support disconnect/revocation. No Dexcom password, Share endpoint, sensor Bluetooth or insulin controls.

## Supabase

Reserved configuration lives in .env.example; no Supabase client is initialized. Before connecting, implement migrations and RLS tests for every user-data table. Private raw readings and private media must be separate from posts. Only an explicitly approved immutable snapshot may be attached to a post. Test cross-user denial, visibility, blocking, comments and signed-media access. There are no migrations or security guarantees in this local-only demo.

## Native and sharing

Expo Router installation and SDK compatibility: https://docs.expo.dev/router/installation/
SVG: https://docs.expo.dev/versions/latest/sdk/svg/
Native capture: https://docs.expo.dev/versions/latest/sdk/captureRef/
Sharing: https://docs.expo.dev/versions/latest/sdk/sharing/
Document picker: https://docs.expo.dev/versions/latest/sdk/document-picker/

Packages are selected by Expo's SDK compatibility installer. Web exports SVG artwork through a browser canvas into PNG; native captures only the artwork View. A generic share sheet lets the user choose supported apps; it does not automatically post to Instagram Stories. Physical-device capture dimensions and permission flows still need an iPhone check.

Apple Health and Health Connect require separate read-permission, policy and native-build feasibility review. HealthKit social/upload restrictions must be reviewed before any server publishing path. Direct Instagram Stories sharing remains planned and requires current official Meta documentation and review.

Public release also requires current privacy/app-store/legal review, encrypted storage for real health information, adult onboarding, moderation, account export/deletion, rate limiting, secure auth and reviewed educational content. No compliance or regulatory approval is claimed.
