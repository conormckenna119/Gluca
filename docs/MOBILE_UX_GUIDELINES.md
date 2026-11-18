# Mobile UI guidelines — Stage 9C

Build on the shared application system in `src/design/tokens.ts` and `src/ui.tsx`. Prefer a shared component adjustment over a one-off screen theme. Preserve light mode, original Gluca art, green accents and every existing privacy/source disclosure. Do not imitate another application's proprietary artwork, logo, brand color or exact layout.

## Layout

1. Design first for 320–430px. Test 320, 375, 393 and 430px in portrait; also 768px/tablet and 1280px/desktop.
2. Keep one readable content column, maximum 720px, with 16px page/card insets and intentional 24px section gaps.
3. Use flexible rows with `minWidth: 0`, sensible wrapping and compact-name ellipsis. Allow expanded names to wrap to two lines. Keep shields fixed-size and at least 44px tappable.
4. Use the shared BrandHeader. Never crop a brand asset by changing its viewBox to a smaller box than its actual path bounds. The full Gluca drop ends at y=48, so application Mark uses a 50-unit viewport.
5. Reserve layout space for the primary navigation and unlock feedback. Never position another bottom bar over the content or add a sixth tab. Respect native insets and web safe-area environment variables. Nested routes must use the existing root shell and route mapping.
6. Keep visible Back/Close controls for intentional authentication/fullscreen exceptions. Avoid scroll traps and clipping parent containers around essential controls.

## Hierarchy and content

- Page title → concise context/source label → primary content → supporting controls.
- Use 16px body/input text, muted metadata, 21px section headings and 32px numeric metrics. Align comparable figures with tabular numerals.
- Keep neutral surfaces; use green for interaction/selection. Do not fill every card green or add decorative glows.
- A posted photograph/story is the visual centerpiece. Preserve its source aspect ratio; display treatment must not stretch the chart or change exported pixels.
- Keep profile public identity distinct from private owner-only information. Section links must target real content. Do not populate layouts with invented activities, locations, maps, achievements or medical statistics.
- Name actual data sources. Demo data remains labelled. Delayed Dexcom data must not be called real-time. Missing readings and incomplete periods remain the analytics engine's responsibility.
- Keep user-authored captions and historic content unchanged. Prefer descriptive copy over motivational slogans.

## Interaction and accessibility

- Touch targets: at least 44×44px; standard buttons at least 48px high. The icon graphic can be smaller than its target.
- Retain readable labels and pressed/selected/disabled state. Keep keyboard alternatives to drag/pinch/resize and meaningful error messages.
- Do not disable browser focus outlines. Color must not be the sole indication of selection, range status or errors.
- Text/primary-action contrast should meet 4.5:1; meaningful graphical accents at least 3:1. Validate both themes against background, surface and raised surface. A border used only for decoration is not a substitute for readable control labels.
- Respect reduced motion. Sheets start static until the preference resolves, subscribe to changes and avoid slide transitions when requested. Existing medal and story motion should follow the same rule.
- Use the named shared Sheet and existing footer inset handling. Make Close, Cancel, confirmation and destructive actions reachable at short heights.
- Keyboard/viewport changes must reduce the content region without hiding navigation. Scroll the final form action fully above the footer. Test focused inputs at a 320×440 browser viewport, but record that this only simulates keyboard pressure.

## Profile and sharing

Public preview uses the existing allowlist and opt-ins. Do not expose diagnosis dates, birthdays, treatment/device information, glucose summaries or private memberships merely to improve visual density. Share profile uses the public handle URL only and never automatically publishes anything. OS sharing/copy is an explicit user action. Members viewing the link still use existing account permissions.

## Create and analytics

Keep layout styling separate from the artwork scene, overlay transforms and clinical calculations. Reuse the existing canvas/SVG exporter and exact 1080px formats; no second renderer. Verify photo replacement, transparency, drag/pinch/handles, scale/opacity, preview/export coordinates, explicit posting and failure recovery after styling. Demo/sandbox simulation marks may not be hidden by a visual theme.

Charts must retain below/in/above words and shapes, gap behavior, source/coverage/delay context and accessible descriptions. Never add rankings, treatment advice or medical-outcome rewards as decoration.

## Verification checklist

- Render each primary route, profile editing/onboarding, settings/Dexcom, cabinet/challenges and relevant detail sheets in both themes.
- Check all supported widths, no horizontal scroll, unclipped logo, target sizes and bottom-content visibility.
- Exercise normal/nested navigation, scrolling, resized/focused-input windows and reduced motion.
- Verify Boost/comment/follow permissions, shields/privacy, actual image export and opt-in publishing with synthetic fixtures.
- Run TypeScript, applicable core/browser tests and the configured formatter/linter. If no lint script exists, say so rather than claiming a lint pass.
- Capture before/after evidence. Separate automated geometry assertions, screenshots actually reviewed, mocked Dexcom journeys and live verification. Never include the owner's private health information in QA artifacts.
- Native builds, real Safari/VoiceOver/TalkBack, dynamic type and actual hardware keyboards/safe areas require a separate device check before public release.

Current test evidence and limitations: `GLUCA_DESIGN_SYSTEM.md` and `UI_REFINEMENT.md`. Stage 9C does not deploy the app or add later-stage features.
