# Community system

**Status:** the suggestions, joining and visibility controls are behind the `identity` flag, which is off by default (`src/flags.ts`). The `communityFeed` and `clubs` flags are on by default and control the demo feed and the Explore screen. Checked on web only on 2026-11-16: type-check, 295 unit tests and a browser walk-through at 375 and 1280 px. Nothing has been run on a phone. No product or clinical review has happened.

Everything is local, fictional and stored on the device. There are no real members.

## 1. Two lists

- **With `identity` on:** Explore uses the catalogue in `src/domain/communities.ts` (15 entries). It shows suggestions and visibility switches.
- **With `identity` off:** Explore uses an older list of demo clubs and a separate join toggle (`src/screens/explore.tsx`). No suggestions are shown and no visibility switch appears.

## 2. The catalogue

Each entry has an id, a name, a blurb that begins "Fictional", and a rule that returns a reason sentence or nothing. "Living" below means a role that is not supporting or awareness (see the note in section 6).

| Community | When it is suggested |
| --- | --- |
| Tandem users | Living, insulin delivery is Tandem |
| Omnipod users | Living, insulin delivery is Omnipod |
| twiist users | Living, insulin delivery is twiist |
| Multiple daily injection users | Living, insulin delivery is injections or pens |
| Dexcom G7 users | Living, CGM brand is Dexcom and the model contains "G7" (spaces allowed) |
| Newly diagnosed T1Ds | Living, type 1, fewer than one completed year |
| Long-term T1Ds | Living, type 1, 20 or more completed years |
| Diabetic runners | Living, an interest contains "run" |
| Diabetes supporters | Role is supporting |
| Parents and caregivers | Emblem is Caregiver (any role) |
| Type 1 Runners | Living, an interest contains "run" |
| Diabetic Golfers | Living, an interest contains "golf" |
| Newly Diagnosed Community | Never suggested (the rule always returns nothing) |
| Diabetes Tech Enthusiasts | Living, an interest contains "tech" |
| T1D Strength Training | Living, an interest contains "strength" or "lifting" |

Completed years come from the shield rules in `docs/IDENTITY_AND_PROFILES.md`, section 4.

## 3. The rules

- Suggestions use only what the person volunteered: profile fields and listed interests. Nothing else is read.
- At most four suggestions are shown (`MAX_SUGGESTIONS`), in catalogue order. Clubs already joined are skipped.
- Suggesting never changes state (`suggestedFor` is pure, and the test checks this).
- Nobody is joined automatically. Joining needs a tap on Join in Explore.
- A new membership starts with visibility off. Visibility can be changed only for a joined club.
- Other people see a membership only when the person has switched on "Display community memberships" and made that club visible (`publicView`).
- Leaving a club removes it and its visibility setting. The joined-count never goes down.
- Joining a club adds to the "Joined a community" medal and the Clubs count on the person's own Profile screen. Nothing ranks clubs or counts members.

## 4. Demo members

- `src/demo-members.ts` holds ten invented people. Their names are demo names. Each has a fixed shield, emblem, insulin or CGM value chosen by hand. None comes from glucose data.
- They appear in Explore under "People" with the note "Fictional profiles for this demo." They appear in feed posts only when `identity` is on.
- Each demo person's public profile is a fixed object in the file, not built from `publicView`.
- Any name that is not a demo person gets a profile that shares nothing.

## 5. Where the code and tests are

- Catalogue, suggestions and membership rules: `src/domain/communities.ts`
- Demo people: `src/demo-members.ts`
- Explore screen (suggestions, clubs, people, visibility switch): `src/screens/explore.tsx`
- Membership switch in Settings and the Profile club count: `src/screens/settings.tsx`, `src/screens/profile.tsx`
- Medal rule that uses membership: `src/achievements/life.ts`
- Tests: `tests/communities.test.ts` (suggestions, limits, join, leave and visibility). Public-view tests for memberships are in `tests/public-view.test.ts`.

## 6. Limits and open questions

- Everything is local and fictional. No real member, message, group or server exists.
- Moderation is limited to what the code has. A person can "Report locally", which saves the post id on the device and says no moderation service is connected. A person can block an author, which hides that author's posts on this device. Blocks can be undone in Settings. There is no review queue, no moderator role and no action taken on reports.
- The "living" condition is true when no role is set (only supporting and awareness are excluded). A profile with no role can therefore receive device and diagnosis suggestions if those fields are filled in.
- The "Newly diagnosed T1Ds" reason says "diagnosed under a year ago". A year-only diagnosis in the previous calendar year gives a count of 0, so the wording can be wrong for that date.
- "Diabetic runners" and "Type 1 Runners" have the same rule and both appear for the same interest. The club and group names have not been checked against real organisations.
- No clinician or product reviewer has looked at the catalogue.
