# Gluca voice and tone

Stage 7A.5, 17 November 2026. Use concise, friendly product language. Describe the action or data rather than judging a person's effort, glucose or worth. Avoid motivational defaults, repeated reassurance, excessive exclamation marks and decorative emoji. Keep source, privacy, delay and error explanations accurate. Birthday celebration preferences remain literal opt-in functionality, not motivational copy.

## Default copy changes

| Previous default | New default |
| --- | --- |
| Another day of showing up. | Daily recap |
| Another week of showing up. | Weekly recap |
| Some days are just like this. | Glucose summary |
| Pancreas replacement shift. | Glucose recap |
| Years of showing up. | Your milestones |
| Stronger than I knew I could be. | No default caption |
| Not every day is a personal best. Showing up still counts. | No default caption |
| Your day, your words… | Choose a template for your recap. Review what’s included before exporting. |
| There is a place for you here. | Your profile is ready. |
| Your journey is yours to share, at your own pace. | Explore the community or connect your glucose data. |
| When did your diabetes journey begin? | When were you diagnosed? |
| Celebrate a personal milestone | Add a personal milestone |
| Another line | Next suggestion |

Removed “My pancreas chose chaos”, “Still here. Still showing up” and similar repeated slogans from suggestions. New milestone graphics no longer invent “10 years”; the person supplies milestone text. Template layouts/IDs remain unchanged. Empty words do not trigger hidden fallback slogans in The real side/Shift report.

Audited Today/My Glucose, Community/Home/Explore, Create, Profile, onboarding, insights, existing achievement/challenge wording, empty states, notices/dialogs and templates. Most ordinary navigation/status/privacy text was already neutral and is retained. Existing challenge/achievement definitions receive copy edits only: no rules, awards, features or saved completions change. Historical/fictional seeded posts, genuine captions and saved data are not rewritten or filtered. No migration or on-load text replacement runs.

## Optional caption tones

Suggestions live separately in `src/art/copy.ts`, rather than being reused as core UI slogans. Every template starts with **Minimal**. In **Create → Customize → Words**, a person can explicitly choose:

- **Minimal:** blank caption, optional “Glucose summary” / “Daily recap”.
- **Casual:** “My day in a chart” / “A look at my day.”
- **Humorous:** “A very detailed line drawing” / “The line has range.”
- **Motivational:** “One day at a time” / “Taking it at my own pace.”
- **Custom:** retain the person's words.

Humorous and Motivational are never automatically selected by template choice. Suggestions are editable and removable; **Remove headline and caption** clears both, without fallback text. Editing marks words Custom so changing style or day/week does not replace them. Selecting a different tone or Next suggestion intentionally replaces current suggestions. The older Educational enum remains readable for compatibility but is not a new tone choice. Tone/words remain in the editing session, without new telemetry or account preference storage.

Claude copy/design note: future refinements should preserve this neutral default and optional tone boundary. Do not replace product status messages with encouragement or rewrite existing user content.
