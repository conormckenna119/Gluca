# Social reactions

**Status:** Boosts are on. They replaced kudos. The Boost button appears on every post card and does not depend on a flag. The `reactionPicker` flag (off) is also unused. Checked on web only on 2026-11-16: type-check, 295 unit tests and a browser walk-through at 375 and 1280 px. Nothing has been run on a phone. No clinical or product review has happened.

Reactions are stored on the device only. No other person sees a Boost that is given here.

## 1. What a Boost is

A Boost is the one positive reaction the interface shows. It is a bolt icon with a count beside it. Tapping it gives a Boost. Tapping it again removes it.

- One reaction per person per post. `toggleReaction` in `src/domain/reactions.ts` holds one kind for each post. Giving a different kind would move the reaction, but only Boost is offered.
- Counts never go below zero.
- The person's own reaction is always included in the count, even if the saved count was 0 (`sanitizeReactions`).
- Nothing in the code stops a person from Boosting their own post. The check only looks at the block list (see section 5).

## 2. The five kinds in the data model

`REACTION_KINDS` in `src/domain/reactions.ts` lists boost, love, celebrate, support and strength. There is no negative kind, and the file says there never will be. `EXPOSED_REACTIONS` lists only boost, so the other four have no button. Their wording exists in `REACTION_WORDS`, ready for a later picker.

## 3. Wording

All reaction words are in one object, `REACTION_WORDS`, in `src/reaction-copy.ts`. To change the term, edit that object. The other lines in the same file build from it. On screen the button shows only the icon and count. The action words are the accessible name.

| Kind | Noun | Accessible action (not given) | Accessible action (given) | Used after "You gave" | Done (past participle) |
| --- | --- | --- | --- | --- | --- |
| boost (shown) | Boost / Boosts | Give a Boost | Remove your Boost | a Boost | Boosted |
| love | Love / Loves | Send love | Remove your love | some love | sent love to |
| celebrate | Cheer / Cheers | Give a Cheer | Remove your Cheer | a Cheer | Cheered |
| support | Support | Show support | Remove your support | some support | supported |
| strength | Strength | Send strength | Remove your strength | some strength | sent strength to |

Phrases the person sees for Boost:

- Other people's posts: "1 Boost" or "24 Boosts". Zero shows nothing.
- Own posts: the number on the button, and "1 person Boosted your post" or "24 people Boosted your post".
- Own posts with at least one Boost: "Your community is cheering you on." (`CHEER_LINE`).
- After giving a Boost, for 3 seconds: "You gave Sarah a Boost." The first name is used (`firstName`). If there is no name, "them".
- Accessible label: "Give a Boost, 3" or "Remove your Boost, 4" (`reactionLabel`).

## 4. Accessibility

Set in `src/components/boost-button.tsx`.

- The control is a button with the label above. Its state is exposed as selected (given) and disabled (blocked).
- The touch target is at least 44 by 44 px.
- A given Boost changes colour and fills the icon, and the count and label change too. Colour is not the only signal.
- The pulse animation is skipped when the device asks for reduced motion.
- The "You gave..." line sits in a polite live region, so screen readers announce it once.

## 5. Blocked authors

A person who has blocked an author cannot Boost that author's posts. The button is disabled and dimmed to 45% opacity. The state update also checks the block list, so a stale button cannot add a Boost (`canReact`, tested in `tests/reaction-copy.test.ts`). Posts by blocked authors are hidden from the feed anyway.

## 6. Old kudos

Posts saved before Boosts had `kudos` and `liked` fields. On load, `migratePost` in `src/state.ts` removes both fields. The kudos count becomes the Boost count. If `liked` was true, the person's own reaction becomes a Boost. `tests/domain.test.ts` checks this.

## 7. The Boost counter

`counters.boostsGiven` goes up when a Boost is given and down when it is removed. It never goes below zero (`nextBoostsGiven`). It feeds the "First kind word" medal (`src/achievements/life.ts`), which also counts comments made.

## 8. Where the code and tests are

- Model and counting rules: `src/domain/reactions.ts`
- Wording and blocked rule: `src/reaction-copy.ts`
- Button: `src/components/boost-button.tsx`, rendered by `src/components/post-card.tsx`
- Old-data conversion: `src/state.ts` (`migratePost`)
- Tests: `tests/domain.test.ts` (toggling, saved data, legacy conversion, only Boost exposed, no negative kind) and `tests/reaction-copy.test.ts` (wording, labels, blocked rule, counter)

## 9. What is not built

- The long-press picker. The `reactionPicker` flag exists, but nothing reads it.
- Showing kinds other than Boost.
- Any sharing of reactions with other people. Everything is local.
- A way to stop a person from Boosting their own post. The code allows it.

## 10. Open questions

- Should a person be able to Boost their own post? The current code allows it and the own-post wording ("people Boosted your post") assumes it is possible.
- No clinician or product reviewer has looked at the wording, including "Cheer" and "cheering you on".
