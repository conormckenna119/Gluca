# Identity shields and supporter emblems

Stage 6B reuses `src/domain/shield.ts`, `public-view.ts` and the existing original SVG shield/emblem components. There is one completed-years calculation. Screens receive its result; they do not duplicate anniversary mathematics.

Stage 7B (17 November 2026) simplifies the existing components; stored identifiers, privacy choices and date calculations remain compatible.

| Completed years | Shield style |
|---|---|
| Less than 1 | Teal |
| 1–4 | Silver |
| 5–9 | Bronze |
| 10–14 | Gold |
| 15–19 | Amethyst |
| 20–24 | Sapphire |
| 25–29 | Emerald |
| 30–39 | Platinum |
| 40–49 | Diamond |
| 50+ | Legacy black/gold |

Every numeric shield has the same silhouette, dimensions and 1.6-unit outline, with the original flat colours and larger centered numerals. No ornaments, double rims, gradients, facets, glow or uncertainty symbol are drawn. Numeric text, accessible labels and the style name in the detail sheet provide information beyond colour. A hidden number leaves the same plain silhouette; users can also hide the whole shield. Internal `tier` IDs and old `mark` metadata are retained for compatibility, but old ornaments are not rendered. Longer duration does not increase size or prominence.

Exact dates complete a year on the anniversary. A 29 February diagnosis completes on **1 March in non-leap years**, preserving the existing calendar convention. Month/year dates count the next year only after the entire anniversary month has passed. Year-only dates use `max(0, currentYear − diagnosisYear − 1)` and update conservatively on the next calendar-year boundary. Those boundaries are calculation rules, not invented diagnosis dates. Explicitly estimated dates stay estimates. No diagnosis date means no numeric shield; malformed/future dates remain rejected.

The icon shows digits only, including when precision is limited. Accessible text and the shared detail sheet explain limited precision. Owner-only details describe the supplied year/month precision and show a next anniversary only for a known, unestimated exact date. Public details receive only the existing allowlisted shield result; they never receive diagnosis date values. There is no existing consent setting for public diagnosis year/month, so this stage does not publish them or add a new sharing field.

The detail sheet uses “Years with diabetes” and “Shield style,” explains its personal meaning and points to visibility controls. Its footer respects native safe-area insets. All styles use the same 72px detail preview. The owner's private profile card now opens the same sheet; the public header remains a public-only projection.

Supporter, caregiver and advocate use one rounded-square frame, consistent padding, icon size, border radius and stroke weight. Their original colours remain. Symbols are an outlined heart, heart over a helping hand and a minimal awareness ribbon. None has a numeric count or hierarchical status. The existing plain variant remains compatible.

One root calendar update refreshes identity displays at local midnight and supported app resume; public API projections calculate from the server date when requested. Device/server timezone differences near midnight are a known boundary; no claim of a universal diagnosis timezone is made. The private date never appears in public profile data.

`UserIdentity` accepts only the allowlisted `PublicProfile`: photo/initials, name, optional handle, shield/emblem, and expanded bio. `AuthorIdentity` resolves existing local fictional authors or the current owner's public projection. They are reused by the profile header, feed/post authors, comment headers, existing Explore people displays and local Following list. No follower/community membership server was invented; those features remain the existing fictional demo. Long display names and handles truncate to one line instead of pushing icons off-screen; expanded headers fit their container and compact buttons do not shrink. Badge tap targets are at least 44px and open the existing explanatory sheet.

Supporter, caregiver and advocate emblems are non-numeric, optional and independent of any Dexcom account. They never grant access to another user's glucose data. Shields represent lived experience, not superiority, clinical expertise, achievement or competitive rank. Public display and number display are separate privacy choices. Switching to supporter/awareness/prefer-not hides medical identity even if a private diagnosis remains stored.

Preview all designs at `/identity-preview` with `identity` enabled. Test core calculations with `npm test` (`shield.test.ts`, `public-view.test.ts`, `profile-experience.test.ts`); see [ONBOARDING.md](ONBOARDING.md) for launch and verification evidence. No achievements, challenges or reactions were added.

Stage 7B before/after screenshots, changed files and verification results: [IDENTITY_UI_REFINEMENT.md](IDENTITY_UI_REFINEMENT.md). Physical-device and screen-reader checks remain open.
