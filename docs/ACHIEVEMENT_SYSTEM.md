# Achievement system

**Status:** behind feature flags that are off by default: `achievements` (life and community medals) and `healthAchievements` (health milestones), in `src/flags.ts`. Checked on web only on 2026-11-16: type-check, 295 unit tests and a browser walk-through at 375 and 1280 px. Nothing has been run on a phone. No clinical or product review has happened. Health rules are in `docs/ACHIEVEMENT_SAFETY.md`, which this page does not restate.

## 1. Three categories

- **Life** and **community**: no glucose data, no opt-in needed, flag `achievements`.
- **Health**: glucose-based, needs the person's own opt-in (`privacy.healthAchievements`), flag `healthAchievements`. Prototype only.

## 2. Registry entry (`AchievementDef`, `src/domain/achievements.ts`)

| Field | Meaning |
| --- | --- |
| `id`, `name`, `description` | Identity and the text shown |
| `category` | `health`, `life` or `community` |
| `icon` | One of eleven medal shapes |
| `requiredData` | What the rule reads: posts, exports, profile, reactions, communities, challenges, events, glucose, a1c |
| `period`, `minCoveragePct` | `none`, `week`, `month`, `quarter` or `year`; glucose rules only: least CGM coverage |
| `defaultVisibility`, `repeatable` | `private` or `public`; `once`, `yearly` or `per_period` |
| `ruleVersion`, `safetyReview` | Bumped when a rule changes; `not_required`, `pending` or `approved` |
| `flag`, `needsHealthOptIn`, `disabled` | Flag that must be on; health rule; true stops the rule without a release |

## 3. Award (`Award`, `src/domain/achievements.ts`)

| Field | Meaning |
| --- | --- |
| `id` | `userId:achievementId:periodKey`; stops duplicates |
| `userId`, `achievementId` | Always `me` (this device); the registry id |
| `awardedAt`, `periodKey` | Time earned in milliseconds; empty for once-only medals, otherwise a calendar key |
| `ruleVersion` | Rule version when earned |
| `snapshot` | Optional numbers, private to the person; never on a public medal |
| `visibility`, `pinned` | `private` or `public`; pinned for the profile |
| `withdrawn` | Optional `{ at, reason }`; hides the medal everywhere |

## 4. Awarding (`src/achievements/engine.ts`)

- Only available rules run: flag on, not `disabled`, and (for health) opted in. Each hit builds an id; if an award with that id exists, nothing is added. Withdrawn awards count, so they are not re-awarded for that period.
- Period keys use local time: `2026`, `2026-11`, `2026-Q4`, `2026-W47` (ISO week). An earned award is never removed or changed when a rule stops matching.
- `useAchievements({ evaluate: true })` runs once, in `app/_layout.tsx`.

## 5. Life and community medals (`src/achievements/life.ts`)

| Id | Name (category) | How it is earned | Repeats |
| --- | --- | --- | --- |
| `first_post` | First post (community) | A post whose author is "You" | Once |
| `first_activity` | First activity marked (life) | An event of kind activity | Once |
| `first_story` | First story exported (life) | Exports counter is 1 or more | Once |
| `diagnosis_anniversary` | Diagnosis anniversary (life) | On or after the anniversary in a later year; with no day, the 1st of the month. Year-only dates never earn it | Yearly |
| `personal_milestone` | Personal milestone (life) | Challenge `personal_milestone` marked done | Once |
| `awareness_contribution` | Awareness contribution (community) | Challenge `awareness_event` marked done | Once |
| `community_participation` | Joined a community (community) | One club joined, or the joined counter is 1 or more | Once |
| `first_support` | First kind word (community) | One Boost given, or one comment made | Once |
| `activity_accomplishment` | Activity of your choice (life) | Challenge `activity_of_choice` marked done | Once |

## 6. Challenges (`src/achievements/challenges.ts`)

| Id | Title | Medal it can unlock |
| --- | --- | --- |
| `share_moment` | Share a moment | None |
| `awareness_event` | Take part in an awareness event | Awareness contribution |
| `activity_of_choice` | An activity you choose | Activity of your choice |
| `personal_milestone` | Celebrate a personal milestone | Personal milestone |
| `helpful_experience` | Share something that helped | None |

The person marks a challenge done in the Medals screen. Nothing checks it, there is no deadline, and a second mark changes nothing.

## 7. Pinning, visibility and withdrawal

- Up to three pins (`MAX_PINNED`); a fourth is refused. Every medal starts private, and "Show on my profile" in the medal sheet switches it.
- Another person sees a medal only when it is public, pinned and not withdrawn. `publicView` lists the award id. No screen shows this to others yet, and `publicMedal` (name, icon, category, year) is unused.
- `withdrawAward` sets `withdrawn` with a reason and unpins. No screen calls it yet.

## 8. Sharing (`src/achievement-share.ts`)

The Share button opens Create with the milestone template. The text comes from the medal name only: a headline "Medal earned: <name>" (at most 90 characters) and a large line with the name (at most 24). Snapshot numbers, glucose values and dates are never used. Create shows "What's on this image" before saving. Nothing is posted automatically.

## 9. Unlock message (`src/components/achievements/unlock-toast.tsx`)

- A card titled "New medal" with View (opens Medals) and Dismiss. One at a time, from a queue, mounted once in `app/_layout.tsx`.
- Not shown when `achievements` is off, when the app is not ready or the welcome screen covers the tabs, when the award is missing or withdrawn, or when a health medal is due and achievement notifications are off.
- It is an in-app message only. No system notification is sent.

## 10. Purpose, possible unintended incentives, privacy, review status

| Medal | Purpose | Possible unintended incentive | Privacy | Review status |
| --- | --- | --- | --- | --- |
| First post | Marks a first share | Pressure to post | Private unless shown | Product review not done |
| First activity | Marks a first logged activity | Logging activity to earn a mark | No snapshot stored | Product review not done |
| First story | Marks a first saved image | Making more images than wanted | No image data kept | Product review not done |
| Diagnosis anniversary | Marks a yearly day the person chose to record | A hard date may feel like a prompt | Uses the diagnosis date on the device; not shared by this medal | Product review not done |
| Personal milestone | Lets the person mark their own milestone | Treating it as a target | Self-marked | Product review not done |
| Awareness contribution | Marks taking part in an event | Pressure to attend events | Self-marked; no event data | Product review not done |
| Joined a community | Marks joining a community | Joining many groups | Membership private until made visible | Product review not done |
| First kind word | Marks a first kind act | Giving Boosts to earn the mark | Counts only the person's own actions | Product review not done |
| Activity of your choice | Marks an activity the person chose | Pushing the pace of activity | Self-marked; text says "a pace that suits you" | Product review not done |
| Health: `tir_milestone`, `steadier_month`, `fewer_lows` | See `docs/ACHIEVEMENT_SAFETY.md` sections 1, 3, 4 and 8 | See section 1 of that file | See section 4 of that file | Clinical review not done; prototype only |

## 11. Disabling an achievement

- To stop one rule: set `disabled: true` on its registry entry. It stops being evaluated and listed. Medals already earned stay.
- To hide all health milestones: turn off `healthAchievements`. All three health rules use that flag. To hide life and community medals: turn off `achievements`.
- Full process, including withdrawing awards and bumping `ruleVersion`: `docs/ACHIEVEMENT_SAFETY.md` section 7. Record the decision in `docs/DECISIONS.md`.

## 12. Where the code and tests are

- Model and engine: `src/domain/achievements.ts`, `src/achievements/engine.ts`, `period.ts`, `registry.ts`, `eligibility.ts`
- Rules: `src/achievements/life.ts`, `health.ts`, `challenges.ts`
- Hook and screen: `src/hooks/use-achievements.ts`, `src/screens/trophies.tsx`
- Components: `src/components/achievements/`; share: `src/achievement-share.ts`
- Tests: `tests/achievements.test.ts`, `tests/achievement-life.test.ts`, `tests/achievement-health.test.ts`, `tests/achievement-share.test.ts`

## 13. Where code and documents differ

- `docs/ACHIEVEMENT_SAFETY.md` section 4 says `tir_milestone` applies "for the first time since opting in". `build()` in `health.ts` does not check when opt-in happened. It awards on the first settled month that qualifies.
- A month-only diagnosis date waits for the month to pass in the shield, but the anniversary medal counts from the 1st of that month.

## 14. Implemented, experimental, tested, needs review

| Part | Status | Tested by | Needs |
| --- | --- | --- | --- |
| Registry, engine, pinning limit, visibility | Implemented behind `achievements` | `tests/achievements.test.ts` | Product review |
| Life and community medals (nine) | Implemented behind `achievements` | `tests/achievement-life.test.ts` | Product review |
| Challenges (five, self-marked) | Implemented behind `achievements` | `tests/achievement-life.test.ts` | Product review |
| Medals screen and medal sheet | Implemented behind `achievements` | Not unit tested | Check on a phone |
| Share to Create | Implemented behind `achievements` | `tests/achievement-share.test.ts` | Check on a phone |
| Unlock message | Implemented behind `achievements` | Not unit tested | Check on a phone |
| Withdrawal | Engine only; no screen calls it | `tests/achievements.test.ts` | Decide whether to add a screen |
| Health milestones and eligibility gate | Experimental behind `healthAchievements` and opt-in | `tests/achievement-health.test.ts` | Clinical review (not done) |
