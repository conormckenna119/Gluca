# Identity and profiles

**Status:** behind the `identity` feature flag, which is off by default (`src/flags.ts`). Checked on web only on 2026-11-16: type-check, 295 unit tests and a browser walk-through at 375 and 1280 px. Nothing has been run on a phone. No clinical or product review has happened.

This page says what the code does. Health rules are in `docs/ACHIEVEMENT_SAFETY.md`.

## 1. What a profile holds

The profile is saved with the rest of the local state. There is no account, and nothing is sent anywhere (`src/domain/profile.ts`).

- Only the display name is needed. It defaults to "You" and is at most 40 characters.
- Everything else is optional: role, diabetes type, diagnosis date, birthday, age confirmation, monitoring, CGM, insulin delivery, emblem and interests (at most 12).
- The birthday is month and day only. A year in saved data is dropped, so no age can be worked out.
- Age confirmation is a tick box ("I confirm I am old enough to use this app"). It is kept apart from the birthday. The code does not define a minimum age.
- `onboarded` records whether the optional questions were answered or skipped.

## 2. The three roles

Which questions are asked is decided by `nextSteps()` in `src/domain/onboarding.ts`. Tests: `tests/onboarding.test.ts`.

| Role | Medical questions asked | Other questions |
| --- | --- | --- |
| I live with diabetes (`living`) | Type, diagnosis date, monitoring, CGM (only with CGM or both), insulin delivery, pump model (only for a pump), units, health achievements choice | Birthday, interests |
| I support someone with diabetes (`supporting`) | None | Emblem, birthday, interests |
| I am interested in diabetes awareness (`awareness`) | None | Emblem, birthday, interests |
| No role chosen | None | Birthday, interests |

Every step can be skipped. Supporters and awareness users are never shown a medical question. Health achievements stay off unless the person chooses them.

## 3. Partial dates

A diagnosis date is a `PartialDate`. A year is always needed. A month and a day are optional, but a day needs a month. The "Not sure of the exact date" switch sets `approximate`. Missing parts are never filled in. Years must fall between 1900 and the current year (`src/components/identity/partial-date-input.tsx`).

## 4. The shield

The shield shows time since diagnosis. It is self-reported and optional. It is not a ranking, and the info sheet says so (`src/components/identity/identity-sheet.tsx`). A tier says nothing about how well anyone manages diabetes.

Tiers are in `SHIELD_TIERS` (`src/domain/shield.ts`). Each tier has its own inner shape, so tiers can be told apart without colour.

| Tier | Completed years from | Inner mark |
| --- | --- | --- |
| teal | 0 | dot |
| silver | 1 | ring |
| bronze | 5 | bar |
| gold | 10 | chevron |
| amethyst | 15 | diamond |
| sapphire | 20 | triangle |
| emerald | 25 | square |
| platinum | 30 | spark |
| diamond | 40 | hexagon |
| legacy | 50 | star |

### How completed years are counted

The count uses the device's local calendar date.

| Diagnosis entered as | Rule | Marked "about"? |
| --- | --- | --- |
| Day, month and year | The year completes on the anniversary day. 29 February counts from 1 March in years without 29 February. | No |
| Month and year | No day is invented. A year counts from the 1st of the month after the anniversary month. During the anniversary month of a later year the count is one lower and is marked "about". | Only in that month |
| Year only | Current year minus diagnosis year minus 1, never below 0. | Yes, in any later year |
| Any of the above with "Not sure" on | Same count as above. | Always |

A diagnosis in the future, or an impossible date, gives no shield. Test cases: `tests/shield.test.ts`. The next-anniversary line appears only on the person's own profile, and only for an exact date.

## 5. Emblems

There are three emblems: Supporter, Caregiver and Advocate (`EMBLEMS`). They are chosen in onboarding for the supporting and awareness roles, and in Edit profile. Their label reads "Says how you take part. Nothing medical." An emblem is shared only when its switch is on.

## 6. Privacy switches

These appear in Settings under "Profile and privacy" when the `identity` flag is on. Every switch starts off. Only the exact value `true` turns a switch on (`sanitizePrivacy`).

| Switch (key) | What others see when it is on | Default |
| --- | --- | --- |
| Show diabetes experience shield (`showShield`) | The shield tier | Off |
| Show years on the shield (`showShieldNumber`) | The number of completed years. Offered only when the shield is on and a diagnosis date exists | Off |
| Show supporter emblem (`showEmblem`) | The chosen emblem | Off |
| Show birthday celebration (`showBirthday`) | A flag that it is their birthday today. No date, no age. Nothing in the app displays this flag yet | Off |
| Display diabetes type (`showDiabetesType`) | The type, unless "prefer not to say" | Off |
| Display insulin delivery method (`showDelivery`) | The method and pump model | Off |
| Display CGM device (`showCgm`) | The brand and model | Off |
| Display community memberships (`showMemberships`) | Only clubs the person has also made visible | Off |
| Enable health achievements (`healthAchievements`) | Nothing. Private. Shown only when the `healthAchievements` flag is on | Off |
| Enable achievement notifications (`achievementNotifications`) | Nothing. Lets health medals show the in-app message. No system notifications exist | Off |

## 7. What the public view never includes

`publicView` (`src/domain/public-view.ts`) builds what another person sees. It never includes the diagnosis date, the birthday date, age, interests, clubs that are not visible, the exact award time, award snapshots, withdrawn awards, or medals that are private or unpinned. It includes no glucose data.

Pinned, public medals appear as award ids (for example `me:first_post:`). No screen turns these ids into names for other people. The demo people in Explore are fixed objects in `src/demo-members.ts`, not built by `publicView`.

## 8. Editing and removing information

- Edit profile (`src/screens/profile-edit.tsx`) changes each field. Each optional field has its own remove action. Changes save as they are made.
- "Remove all optional information" deletes the role, diabetes details, diagnosis date, devices, emblem, birthday, age confirmation and interests. It keeps the display name and the privacy switches. It does not change memberships or medals, which are stored separately.
- Settings has a separate "Reset local demo data" action. Its text lists posts, imported readings and preferences; this page does not check whether it also clears the profile.
- These controls appear only when `identity` is on. Edit profile redirects to Create when it is off.

## 9. Where the code and tests are

- Model and rules: `src/domain/profile.ts`, `shield.ts`, `public-view.ts`, `onboarding.ts`
- Components: `src/components/identity/`; screens: `src/screens/onboarding.tsx`, `profile-edit.tsx`, `profile.tsx`, `settings.tsx`, `identity-preview.tsx`
- Tests: `tests/shield.test.ts`, `tests/public-view.test.ts`, `tests/onboarding.test.ts`, and sanitising tests in `tests/domain.test.ts`

## 10. Not verified and open questions

- No minimum age is defined. The age tick box is self-declared and is not checked.
- The birthday flag is produced but not displayed. Birthday notifications are not built.
- A shared shield does not say "about" for an approximate count. `src/components/identity/name-line.tsx` sets `certain` to true, so other people see the number without "about". The person's own shield card does say "about".
- Onboarding has no route guard in `src/nav.ts`. The screen itself redirects to Create when `identity` is off.
- Everything is self-reported and stored on the device. Nobody checks it.
- No clinician or product reviewer has looked at these rules.
