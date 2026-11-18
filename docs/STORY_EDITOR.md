# Stage 8A.5 - confirmed export-to-feed publishing (18 November 2026)

This section supersedes older local publisher/button descriptions below. The existing renderer, normalized overlay model, templates and Post/PostCard feed model remain in use.

## Root cause and corrected flow

Export previously discarded its PNG after starting a download/share sheet. PublishCard independently saved a caption and recomputed numerical snapshot in device-local demo state; it never attached the rendered image, had no authenticated media API, offered unimplemented followers/public permissions and was hidden for Dexcom data. Consequently a generated graphic could not reach the feed.

Create -> customize -> optionally enable **Also post to Gluca** (default off) -> review caption/audience -> **Export & Post** -> confirm the actual graphic -> export -> publish. Off uses **Export Graphic**, with no post request. The existing PublishCard now configures the export flow instead of creating a second snapshot. Caption is optional and empty by default. Audience starts Private; Public means other signed-in users on this same Gluca backend. Followers-only is not offered. No automatic migration/publication of historical local posts.

exportImage retains the already-rendered web PNG only when publishing is requested. The download and upload use identical bytes; no second export renderer, resizing, screenshot reconstruction or statistical recalculation. Photo background, alpha, overlay transforms and dimensions stay in the shared composition. Preview shows the exact image/audience being confirmed. Feed images preserve their original width/height aspect ratio with a display-only dark matte for transparent artwork; alpha in the stored image is unchanged.

POST /api/posts validates a bounded complete 1080px RGB/RGBA PNG (1080/1350/1920 height), caption/alt limits and Private/Public audience. Existing session/CSRF/encryption infrastructure is reused. Migration 7 adds account-owned feed_posts with UNIQUE(user_id,request_key), audience CHECK, encrypted image and metadata. Image reads authenticate and enforce owner-or-Public access every time; anonymous reads are denied even for Public. Images use no-store and same-origin policy. There is no raw glucose upload, telemetry payload or new storage service. Only the explicitly confirmed image, caption and alternative text persist.

Repeated taps are locked immediately. The same request key is reused for retries after timeouts or lost responses. If export succeeds but posting fails, the UI says so and offers **Retry publishing** without exporting again. The original image/caption/audience are retained in memory; editing the current draft does not alter that retry. Discarding a retry warns that a server post may already exist: inspect the feed first. Reload clears pending image memory; it does not automatically republish. Account changes clear drafts/retries and discard late work. Guests and native clients without the validated web account flow can still export, but cannot post.

## Simplified controls and accessibility

The always-visible What's on this image list is removed from the main flow. **Accessibility options** retains the generated contents list and an optional manually editable image description. Artwork preview and published images keep alternative text; generated text describes only visible image content. Nothing from private profiles is attached automatically.

Directional buttons are behind **Alternative positioning controls**. Dragging, pinch, corner handles, scale, opacity, reset, photo replacement and template/date selection retain their existing implementation. Selected overlays still support keyboard arrows/Escape on web. No advanced editor replacement was built.

## Windows launch and verification

The current local backend was reloaded after verification. Refresh the app; sign in if requested. For a later cold start, from the existing project (stop its existing backend first rather than starting a duplicate):

```powershell
Set-Location 'C:\Users\conor\Documents\Codex\2026-11-12\le\outputs\gluca'
$env:EXPO_PUBLIC_FLAGS='identity,accounts,achievements,dexcomApi,dexcomDiagnostics,dexcomSync'
$env:EXPO_NO_TELEMETRY='1'
$env:EXPO_OFFLINE='1'
npx expo export --platform web --dev --max-workers 2
npm run server
```

Keep existing backend-only .env credentials, session secret and encryption key; no new credential is required. The environment's existing restricted launcher still loads the same server/index.ts. No second application/backend or real account was created for testing.

```powershell
npm run typecheck
npm test
$env:E2E_BASE_URL='http://localhost:3000'
npx playwright test tests/e2e/stage8a5.spec.ts --workers 1
```

Browser publishing tests use the real backend implementation with isolated in-memory SQLite, fictional accounts and synthetic images. Upload/response failure injections are mocked; the successful PNG publication, byte comparison, feed view and persistence are real local operations. No owner post was published by the agent. Dexcom verification in this stage is mocked, not a new live sandbox check.

## Remaining limits

Development web posting is supported; physical native account/media upload remains gated. Native export/photo-library/device share still work through the existing path, and opening an external share sheet is never reported as a Gluca post. Account posts currently have read-only comments/reactions and owner deletion; the fictional local social workflow remains intact. Followers-only, remote comment/reaction services, caption editing, feed pagination beyond the latest 30 posts, durable offline drafts, quotas/moderation and public production hosting are future work. PNG limit is about 9 MB decoded file bytes (12 MB base64); a larger photo may export normally but requires a smaller image before publishing. No silent recompression.

Owner deletion clears encrypted image/caption data and leaves a minimal idempotency tombstone to prevent delayed retries resurrecting the post. This is logical deletion, not a claim of secure filesystem/backup erasure. Existing encryption key backup/retention and production authentication policies still apply.

# Story editor — Stage 7A.5

Stage 7C usability update: tap a selected overlay again (or press Escape on web) to finish positioning and restore scrolling without reaching controls below the preview. Drag/resize/pinch movement does not deselect the group. Photo controls show a pending state, prevent concurrent picks and ignore results after their template/account context is replaced. Selected-period rows are memoized independently of transform changes. [Audit and verification](UI_UX_AUDIT.md).

Open **Create → Demo data (or your selected provider) → Transparent overlay**. Tap the preview or **Edit overlay**. Drag to move, pinch on touch browsers/native or drag a desktop corner handle to resize. Size/opacity sliders, four movement buttons and Reset layout provide alternatives. Desktop arrows move by 0.5% of the canvas; Shift + arrow moves by 2%. **Done positioning** restores normal scrolling over the preview. Other controls and primary navigation remain usable while positioning.

## Scene and coordinates

The original template was a fixed full-canvas SVG. There was no overlay transform state or gesture target. `src/overlay-transform.ts` now owns the shared, pure transform model:

| Field    | Meaning                                              | Bounds/default       |
| -------- | ---------------------------------------------------- | -------------------- |
| x, y     | Group center, as fractions of canvas width/height    | 0.1–0.9; default 0.5 |
| scale    | Uniform multiplier on the entire template foreground | 0.5–1.5; default 1   |
| opacity  | Foreground opacity                                   | 0.2–1; default 1     |
| rotation | Reserved, not supported                              | 0                    |

For canvas W × H, the SVG group translates to `((x − scale/2) × W, (y − scale/2) × H)` and uniformly scales. No independent horizontal/vertical stretch is possible. Coordinates therefore survive responsive resizing and Story/Portrait/Square changes. Center bounds keep the group reachable; handles are clamped within the canvas. Edges can intentionally crop. Check the preview and small text before exporting; reset restores the complete original layout.

Layer order remains photograph (cover crop) or original solid template background → glucose visualization → text/statistics → original decorative artwork. Transparent mode transforms the foreground SVG as one group. The photograph never participates in that transform. Solid templates retain their original layouts; switching back to transparency restores the stored placement and photo. Choosing a new style retains its original transparency default. Data, dates, unit conversion and clinical calculations are separate from placement state.

**Mandatory source disclosure is the exception to the editable group:** demo/sandbox simulation labels stay in the original footer at full opacity. They cannot be moved off-canvas or faded away. No label is added to private CSV data. The disclosure remains in the existing “What’s on this image” list.

## Preview and export

Create applies the same `transformOverlaySvg()` to preview and export SVGs. Existing native SVG font compatibility and web embedded fonts remain. The web renderer still paints photo first, transformed SVG second; native view-shot captures only the artwork surface. Selection outlines, 44px corner hit targets and the preview-only dark matte are siblings outside that capture surface. They never enter the SVG or web PNG. The matte makes white transparent ink visible in light mode; it is not an exported background.

Exports keep exact existing sizes: Story **1080 × 1920**, Portrait **1080 × 1350**, Square **1080 × 1080**. No photo plus transparent mode retains actual PNG alpha. A photo-backed PNG composites opaque photography behind the group. “Transparent: off” uses the original solid template background.

Layout survives photo replacement/removal, style/date changes and tab navigation while the screen is retained. User-written headline/caption and milestone text survive template changes. The layout/photo remain in component memory; reload starts a new editing session. Account-scope changes clear the layout/photo. No draft database, photo upload, analytics property or backend change is introduced.

## Controls and implementation

- `overlay-interaction.web.tsx`: Pointer Events/capture, pinch distance, desktop handles, keyboard movement, selected/unselected touch-action.
- `overlay-interaction.tsx`: stable native PanResponder, drag/pinch rebasing; native handles are not required (pinch/sliders/buttons are the alternatives).
- `editor-slider.web.tsx` / `.tsx`: native HTML range or accessible adjustable RN track, without another dependency.
- `overlay-controls.tsx`: existing product primitives, size/opacity/reset/directional controls.
- `artwork-preview.tsx`: capture surface and separate editing chrome/matte.
- `screens/create.tsx`: independent transform state and shared preview/export application.

## Verification and limitations

See [UI_REFINEMENT.md](UI_REFINEMENT.md) for commands, results and visual evidence. Browser touch gestures are simulated Chromium touch events, not a physical iPhone/Android test. Native touch, screen reader behavior and native alpha capture still require physical-device verification. Rotation, photo transforms, individual element editing, undo/redo and saved drafts are outside this stage. There is no new synchronization, medical calculation or social feature.

Claude design note: future visual polish may refine handle/slider styling and typography, but retain normalized transforms, separate photo/foreground layers, touch targets, alpha, shared export composition and the pinned source disclosure.
