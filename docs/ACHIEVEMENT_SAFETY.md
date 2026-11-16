# Achievement safety

Written 2026-11-16. Status: **prototype rules, not clinically reviewed.** Nothing in this file has been checked by a clinician. Health achievements stay behind the `healthAchievements` flag (off) until a qualified clinical reviewer signs each rule off here.

Gluca is not a medical device. An achievement is a way to mark something the person chose to celebrate. It is never advice, never proof that someone's glucose management was safe or healthy, and never a reason to change treatment.

## 1. What will never be built

These are refused outright, whatever the flag state:

- Lowest-ever glucose, lowest average glucose, or lowest A1C awards or comparisons.
- Public glucose leaderboards or any ranking of people by a health number.
- Rewards for fewer insulin doses, for fasting, or for restricting meals.
- "Perfect glucose" awards or streaks of in-range days.
- Live progress bars or countdowns toward a glucose-based medal ("2% to go").
- Prizes with money value tied to a medical outcome.
- Notifications that someone did not qualify, or any wording that reads as failure.
- Removing an earned medal because later numbers changed.

`tests/achievements.test.ts` scans every achievement and challenge text for wording that would signal one of these (streak, leaderboard, rank, lowest, record, beat, perfect, fasting, dose).

## 2. Two kinds of achievement

| Kind | Depends on glucose? | Default | Status |
| --- | --- | --- | --- |
| Life and community (first post, first export, diagnosis anniversary, challenges, first Boost given …) | No | Private; the person may show each medal | Built behind `achievements`; no clinical review needed |
| Health milestones | Yes | Private; opt-in; retrospective only | Prototype behind `healthAchievements`; **needs clinical review** |

Supporters and people without diabetes can earn every life and community medal.

## 3. Health milestones: the eligibility gate

A health milestone is only considered when **every** line below holds. If any line fails, nothing happens: no message, no hint, no partial credit. The person's ordinary private insights are unaffected.

1. **Opt-in and flags.** `healthAchievements` flag on, and the person switched on "Enable health achievements" (`privacy.healthAchievements`). Off by default.
2. **Who the general thresholds can apply to.** The person confirmed they are an adult (`profile.ageConfirmed`), and their diabetes type is not gestational. The general adult reference targets must not be applied to children, pregnancy, or anyone whose care team set different targets. Until individualized targets are designed and reviewed, anyone outside this group is simply not eligible.
3. **Completed period.** The period is a whole calendar month that has ended, and at least 48 hours have passed since it ended, so late-arriving readings are in. Nothing is evaluated on a period that is still running.
4. **Coverage.** Readings cover at least 90% of the period (duration-weighted, from the existing analytics engine), and at least 26 of the days in the month each have 70% coverage or more. Missing time is never treated as in range.
5. **One comparable definition.** The same target range applied for the whole period (and for the baseline period when two are compared). If the person changed their range part-way, the period is not eligible. Low thresholds are fixed at 70 and 54 mg/dL.
6. **One real source.** Every reading in the period comes from the same kind of source (CSV import or Dexcom). Synthetic demo data can only produce a medal in prototype mode, and that medal is labelled "Demo data" and can never be made public.
7. **Low-glucose guard.** Time below 70 mg/dL is under 4% and time below 54 mg/dL is under 1% for the period. These are the general nonpregnant adult reference figures from the ADA Standards of Care, used here as a guard against rewarding a period with a lot of low glucose. They are not treatment goals.
8. **Severe hypoglycaemia.** If the person has recorded a severe low in the period, the period is not eligible. (Gluca has no way to record this yet; the rule is written so it applies when it does. Until then the check reports "not available", which is recorded on the award.)
9. **A meaningful change.** Each rule below says what counts. Small movements inside measurement noise do not.

Passing the gate means "this period can be considered for a medal". It does not mean the period was safe or healthy, and the app must never say so.

## 4. Health milestones in the prototype

All are private by default, awarded only after the fact, and carry `safetyReview: "pending"`.

| Id | Name | Rule (in addition to the gate) | Repeats | Incentive risk | Mitigation |
| --- | --- | --- | --- | --- | --- |
| `tir_milestone` | A month to remember | Time in range for the most recent completed month is 70% or more. Only evaluated while the person is opted in | Once | Running low to stay under the upper limit | Low-glucose guard; awarded once, so nothing to chase monthly |
| `steadier_month` | A steadier month | Time in range rose by at least 5 percentage points against the previous completed month, and time below 70 and below 54 are both no higher than in that month | At most once a quarter | Over-correcting highs; chasing month-on-month gains | Lows must not rise; quarterly cap; the baseline month must pass the coverage and definition lines too |
| `fewer_lows` | Fewer lows | The previous month had 4% or more below 70; this month is lower by at least 1 percentage point, below 54 is no higher, and time in range did not fall by more than 5 points | At most once a quarter | Running high to avoid lows | Time in range must hold; awarded on reduction, not on reaching zero |

Wording never uses "record", "best" or "beat". The medal's private detail may show the two percentages; the public medal and any shared image show the name only, unless the person explicitly adds numbers in Story Studio and sees them in "What's on this image".

## 5. Specified but not built

| Idea | Why it waits |
| --- | --- |
| Reached a personally set A1C goal | Needs a way to enter a laboratory result with its date and source, and a reviewed rule for which goals are acceptable. A lab A1C and a self-reported A1C must be labelled as such. GMI or any estimated A1C is never shown or counted as a measured A1C. Lower-and-lower A1C milestones will not be built |
| Kept a personal glucose goal over several months | Close to a streak. Needs a design that does not punish a break, and clinical review |
| Individualized targets (children, pregnancy, care-team targets) | Needs clinical input on which settings are safe to let a person choose and how to compare periods |

## 6. Notifications and presentation

- Health medals are announced only after the period has closed and settled, at most one at a time, and only if the person turned on achievement notifications.
- No "almost there", no reminders to improve, no comparison with other people.
- A medal can be celebrated without showing any glucose value. That is the default.
- Not qualifying is silent.

## 7. Correcting and disabling

- **Wrong data.** If an award was based on readings that were later corrected or removed, it can be withdrawn (`withdrawAward`), with the reason kept. A withdrawn award is hidden and is not re-awarded for the same period. An award is never withdrawn because later periods look different.
- **Switching one achievement off.** Set `disabled: true` on its registry entry. It stops being evaluated and stops appearing as something to earn; medals already earned stay with the person.
- **Switching all health milestones off.** Turn off the `healthAchievements` flag.
- **Changing a rule.** Bump `ruleVersion`. Existing awards keep the version they were earned under.
- **When to act.** If user research, support messages or a clinician report someone changing treatment, restricting food, over-exercising or feeling shamed because of an achievement, disable that achievement first, then investigate. Record the decision in `docs/DECISIONS.md`.

## 8. Review status

| Item | Built | Automated tests | Clinical review | Product review |
| --- | --- | --- | --- | --- |
| Eligibility gate (section 3) | See `docs/ROADMAP.md` M13 | See M13 | **Not done** | Not done |
| `tir_milestone`, `steadier_month`, `fewer_lows` | See M13 | See M13 | **Not done** | Not done |
| Life and community medals | See M13 | See M13 | Not needed | Not done |
| A1C goal, sustained goal, individualized targets | No | No | Not done | Not done |

## 9. References

- American Diabetes Association, Standards of Care in Diabetes, glycemic goals section: general CGM reference targets for most nonpregnant adults (time in range 70–180 mg/dL above 70%, below 70 under 4%, below 54 under 1%). The current edition must be read by the clinical reviewer; these figures were not re-checked against the published text while writing this file.
- International consensus on time in range (Battelino et al., Diabetes Care 2019), the source of those CGM targets and of the usual coverage guidance. Also not re-checked here.
