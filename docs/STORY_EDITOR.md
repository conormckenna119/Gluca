# Story editor — Stage 7A.5

Open **Create → Demo data (or your selected provider) → Transparent overlay**. Tap the preview or **Edit overlay**. Drag to move, pinch on touch browsers/native or drag a desktop corner handle to resize. Size/opacity sliders, four movement buttons and Reset layout provide alternatives. Desktop arrows move by 0.5% of the canvas; Shift + arrow moves by 2%. **Done positioning** restores normal scrolling over the preview. Other controls and primary navigation remain usable while positioning.

## Scene and coordinates

The original template was a fixed full-canvas SVG. There was no overlay transform state or gesture target. `src/overlay-transform.ts` now owns the shared, pure transform model:

| Field | Meaning | Bounds/default |
| --- | --- | --- |
| x, y | Group center, as fractions of canvas width/height | 0.1–0.9; default 0.5 |
| scale | Uniform multiplier on the entire template foreground | 0.5–1.5; default 1 |
| opacity | Foreground opacity | 0.2–1; default 1 |
| rotation | Reserved, not supported | 0 |

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
