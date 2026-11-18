# Gluca application design system — Stage 9C

The existing application has been restyled through shared components, preserving its green identity, original logo paths, shields, medal artwork and Story Studio renderer. No Strava branding, icons, artwork, orange or exact screen was copied. No Strava reference image was attached or found in the repository for this stage; the written design principles guided the work.

Application tokens live in `src/design/tokens.ts` and are re-exported by `src/ui.tsx` to preserve existing imports. Story artwork keeps its existing independent palette, Inter fonts and export coordinates; these changes apply to application chrome rather than rewriting generated graphics.

## Palette

| Token     | Dark    | Light   | Purpose                               |
| --------- | ------- | ------- | ------------------------------------- |
| bg        | #101413 | #F3F6F4 | Page background                       |
| surface   | #1B2320 | #FFFFFF | Cards and navigation                  |
| raised    | #242B27 | #EAF0EC | Inputs and secondary surfaces         |
| text      | #F5F8F6 | #132119 | Primary content                       |
| muted     | #A7B5AC | #4A5E53 | Secondary content                     |
| border    | #37443C | #D5E0D9 | Restrained separators/outlines        |
| accent    | #91E6B2 | #1F7A4A | Existing Gluca brand green, preserved |
| accentInk | #0C1410 | #FFFFFF | Text on primary actions               |
| focus     | #76B8FF | #1D5FB5 | Focus/accent support                  |
| below     | #FFBD82 | #9A5311 | Existing below-range amber            |
| inRange   | #91E6B2 | #1F7A4A | Existing in-range mint/green          |
| above     | #C5B3FF | #5B47B0 | Existing above-range lavender         |

Use green for actions, selection and chart accents, not as the default card background. Range status retains words and shapes; color is not its only signal. This is not a red/green medical grading system. Unit tests verify primary/secondary text contrast of at least 4.5:1 on all three theme surfaces, accent contrast of at least 3:1 and primary-action ink contrast of at least 4.5:1. These checks do not imply a full accessibility certification.

## Typography

Application text uses the system stack: web `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; iOS `System`; Android `sans-serif`. No new font dependency or remote font request. The existing bundled Inter families remain dedicated to story artwork.

| Role            | Size / line height | Weight           | Use                                    |
| --------------- | ------------------ | ---------------- | -------------------------------------- |
| Page title      | 32 / 38            | 800              | One prominent page heading             |
| Section heading | 21 / 28            | 700              | Sections and post titles               |
| Body            | 16 / 24            | 400              | Captions and explanations              |
| Caption         | 13 / 19            | 400              | Metadata                               |
| Metric          | 32 / 39            | 800              | Statistics, with tabular numerals      |
| Label           | 12 / 17            | 600              | Source/section metadata, sentence case |
| Button          | 15 / 21            | 600, primary 700 | Controls                               |

Expanded identity names use 26px/32px; compact identities retain 16px readable names, one-line ellipsis and fixed-size tappable shields. Expanded avatars are 80px, compact avatars 36px. Do not scale shield prominence with years of experience. Existing diagnosis precision and public-field opt-ins are unchanged.

## Spacing, shape and depth

- Spacing scale: 4, 8, 12, 16, 24, 32px.
- Content column: maximum 720px; page/card insets 16px; section gaps 24px.
- Radii: 8px small, 14px controls/media, 20px cards, pill 999px.
- Card borders: 0.5px; control outlines: 1px. Neutral cards have no added heavy shadow.
- Buttons: minimum 48px high; icon/shield controls at least 44px. Press feedback uses restrained opacity rather than scale movement.
- Primary buttons use green/contrasting ink. Secondary buttons are outlined pills; selection uses green text/outline where appropriate. Chips retain explicit selected state/check feedback.
- Only the navigation gets the restrained shared depth token: black shadow, opacity 0.14, radius 16, offset 0×5, native elevation 5. Existing original medal/story artwork is not recolored by this token.

## Header and logo clipping fix

**Actual cause:** `DROP_PATH` starts at y=2, reaches y=32 and includes a radius-16 lower arc ending at y=48. `Mark` declared a `0 0 36 36` viewBox, clipping the lower 12 coordinate units. This was an SVG viewport error, not a bad source path or a z-index issue.

The original `DROP_PATH`, `PEAK_PATH`, stroke width and stored assets were retained. The application Mark now uses `0 0 36 50`, with 2 units of vertical clearance. A shared 44px-tall BrandHeader contains the 28px mark and existing product-name wordmark in both tab and nested headers. Router-managed top safe areas remain responsible for status-bar clearance. Repeated all-caps brand eyebrows were removed from Page bodies.

Before evidence records the rendered path bounding box `(2,2,32,46)` ending at 48 inside a viewBox ending at 36. After tests check path containment and header/SVG CSS bounds across mobile, tablet and desktop widths in both themes. See `docs/screenshots/stage9c/before/metrics.json` and the corresponding `after/metrics.json`. Story export branding is unchanged because the artwork renderer does not use this clipped application component viewport.

## Navigation

The existing root ApplicationShell still owns the sole five-destination navigation. The bar is a centered pill, maximum 560px wide, with 12px side/bottom breathing room, 64px nominal inner height and 56px tab targets. Native bottom insets and web `env(safe-area-inset-bottom)` are respected.

The pill is **inside reserved footer space**, not layered over page content. Page flex height ends before the footer; bottom content padding allows the final control to scroll fully into view. Existing visualViewport resize/offset handling remains, including reduced-height keyboard-like browser windows. Achievement feedback retains its own reserved area above the footer. No duplicated page navigation or route migration.

Authentication/welcome retain the existing intentional exceptions, with visible Close. Existing route targeting, nested-stack pop behavior and active-destination mapping are preserved. The old regression expecting the bar itself to touch the viewport was updated to assert the reserved footer stays anchored while the pill keeps its intentional inset.

## Screen patterns

- **Profile:** prominent avatar/name, subtle tappable shield, optional public bio, outlined Edit/Share actions and server-derived follower/following metrics. Overview/Posts/More are jump links into existing content, not another primary navigator or invented empty features. Private shield/date details, legacy demo counts, saved-public-profile action, blocks and settings remain available under More. Own communities, pinned medals and Trophy Cabinet are reused. Share profile shares/copies the saved public handle URL only; no diagnosis, treatment, device or glucose payload. Viewing the existing public-shaped profile still requires a Gluca account.
- **Feed:** shorter header, one compact interaction toolbar, existing filters, neutral cards and caption/title preceding the large graphic. Image aspect ratio and underlying exported bytes remain unchanged; rounded display edges do not alter the stored image. Boost/comment behavior, public/private/community audiences and author privacy are unchanged.
- **My Glucose / insights:** balanced neutral reading/period tiles, larger tabular statistics, native/system chart labels and existing green chart accents. The existing This period section provides insights; no new destination or calculations were created. Source, coverage, delayed-data and safety labels remain.
- **Create:** existing source controls, canvas, template strip, photo picker, drag/pinch/resize, opacity, accessibility disclosures, export confirmation and optional posting remain. Selected templates use a thinner clear border/check. No new panels or renderer.
- **Communities, challenges, cabinet, settings, onboarding:** shared typography, surfaces, controls and sheets carry the restyle through existing layouts. Original shield/medal art, awards, membership and eligibility rules remain.

## Motion and accessibility

Sheets subscribe to the platform reduced-motion preference and start static until it resolves; reduced motion uses no slide. Existing achievement/gesture motion handling is preserved. Keyboard focus behavior and accessible action names remain, including the long accessible Discover Challenges name behind the shorter visible toolbar label. Inputs retain 16px text. Numeric statistics use tabular figures. Essential content/permissions are never encoded only by color.

Native devices, VoiceOver/TalkBack and real iOS keyboard/safe-area behavior still require device verification. Web viewport tests are not a substitute for those checks. Clipboard behavior is exercised through an isolated test stub to avoid replacing the owner's system clipboard; OS share-sheet behavior is not claimed tested. Existing security, privacy and medical-safety documentation still applies.

## Implementation inventory

New: `src/design/tokens.ts`, `src/components/brand-header.tsx`, `src/hooks/use-reduced-motion.ts`, `tests/design-system.test.ts`, `tests/e2e/stage9c.spec.ts`.

Updated: existing `src/ui.tsx`, Page, ApplicationShell, identity NameLine/UserIdentity, PostCard, shared social controls, template strip, glucose chart/tiles, Home/Profile, tab/root header configuration. Existing navigation/cabinet/challenge visual assertions were updated for deliberate inset/palette changes. No server, database migration, glucose model/calculation, achievement rule, Dexcom service or Story Studio rendering-engine change.

Verification results and remaining issues are recorded in `UI_REFINEMENT.md`. Before/after screenshots use fictional accounts and synthetic data only.
