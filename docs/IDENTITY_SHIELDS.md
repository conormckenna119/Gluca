# Identity shields and supporter emblems

Stage 6B reuses `src/domain/shield.ts`, `public-view.ts` and the existing original SVG shield/emblem components. There is one completed-years calculation. Screens receive its result; they do not duplicate anniversary mathematics.

| Completed years | Tier | Non-colour mark |
|---|---|---|
| Less than 1 | Teal | Dot |
| 1–4 | Silver | Ring |
| 5–9 | Bronze | Bar |
| 10–14 | Gold | Chevron |
| 15–19 | Amethyst | Diamond |
| 20–24 | Sapphire | Triangle |
| 25–29 | Emerald | Square |
| 30–39 | Platinum | Spark and double rim |
| 40–49 | Diamond | Hexagon |
| 50+ | Legacy black/gold | Star and double rim |

The SVG now has a restrained metallic highlight/facet treatment while retaining original silhouettes, distinct marks and readable numerals. The onboarding preview fades gently when the tier/count changes and honors reduced-motion preferences. No third-party badge artwork or bitmap dependency is used.

Exact dates complete a year on their anniversary. A 29 February diagnosis completes on **1 March in non-leap years**, an explicit calendar convention. Month/year dates count conservatively until the anniversary month has passed; within that month the count is uncertain. Year-only dates use a conservative lower count and remain approximate. Uncertain/approximate counts carry an **≈** in the shield and “about” in accessible text; no exact next anniversary is offered. No diagnosis date means no numeric shield. Future/malformed dates are rejected. These rules preserve the supplied precision rather than inventing January 1 or an unknown day.

One root calendar update refreshes identity displays at local midnight and supported app resume; public API projections calculate from the server date when requested. Device/server timezone differences near midnight are a known boundary; no claim of a universal diagnosis timezone is made. The private date never appears in public profile data.

`UserIdentity` accepts only the allowlisted `PublicProfile`: photo/initials, name, optional handle, shield/emblem, and expanded bio. `AuthorIdentity` resolves existing local fictional authors or the current owner's public projection. They are reused by the profile header, feed/post authors, comment headers, existing Explore people displays and local Following list. No follower/community membership server was invented; those features remain the existing fictional demo. Long names truncate cleanly instead of pushing the shield off-screen. Badge tap targets are at least 44px and open the existing explanatory sheet.

Supporter, caregiver and advocate emblems are non-numeric, optional and independent of any Dexcom account. They never grant access to another user's glucose data. Shields represent lived experience, not superiority, clinical expertise, achievement or competitive rank. Public display and number display are separate privacy choices. Switching to supporter/awareness/prefer-not hides medical identity even if a private diagnosis remains stored.

Preview all designs at `/identity-preview` with `identity` enabled. Test core calculations with `npm test` (`shield.test.ts`, `public-view.test.ts`, `profile-experience.test.ts`); see [ONBOARDING.md](ONBOARDING.md) for launch and verification evidence. No achievements, challenges or reactions were added.
