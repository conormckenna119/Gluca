// Tone presets: headline and caption suggestions. Every line is optional and editable.
//
// Rules for this copy: supportive or neutral, never judging a person by a glucose number, no advice about insulin/food/exercise,
// no jokes that reward unsafe management. Educational lines state general facts only and MUST be reviewed against reputable
// sources (e.g. ADA, Dexcom, Diabetes UK) before any public release. See docs/VALIDATION_PLAN.md.

import type { TemplateId } from "./telemetry";

export type Tone =
  "minimal" | "casual" | "humorous" | "motivational" | "educational" | "custom";
export const TONES: Tone[] = [
  "minimal",
  "casual",
  "humorous",
  "motivational",
  "custom",
];
export const TONE_LABEL: Record<Tone, string> = {
  minimal: "Minimal",
  casual: "Casual",
  humorous: "Humorous",
  motivational: "Motivational",
  educational: "Educational",
  custom: "Custom",
};

// Suggestions are opt-in. Educational remains readable for older settings, but is not offered as a new tone.
export const HEADLINES: Record<Exclude<Tone, "custom">, string[]> = {
  minimal: ["", "Glucose summary", "Daily recap"],
  casual: ["My day in a chart", "A quick recap", "Today, in numbers"],
  humorous: ["A very detailed line drawing", "CGM camera roll", "Plot twist"],
  motivational: [
    "One day at a time",
    "Making space for myself",
    "On my own terms",
  ],
  educational: ["What a CGM sees in a day.", "Glucose moves all day long."],
};
export const CAPTIONS: Record<Exclude<Tone, "custom">, string[]> = {
  minimal: [""],
  casual: ["A look at my day.", "Keeping a record.", "My latest recap."],
  humorous: ["The line has range.", "My most documented activity."],
  motivational: ["Taking it at my own pace.", "A moment to reflect."],
  educational: ["These are my numbers only. Everyone’s diabetes is different."],
};

export interface CopyDefaults {
  tone: Tone;
  headline: string;
  caption: string;
  milestoneBig: string;
}

export function defaultCopy(template: TemplateId): CopyDefaults {
  const headlines: Record<TemplateId, string> = {
    minimal_trace: "",
    daily_recap: "Daily recap",
    transparent_overlay: "",
    real_side: "Glucose summary",
    humorous: "Glucose recap",
    milestone: "Your milestones",
  };
  return {
    tone: "minimal",
    headline: headlines[template],
    caption: "",
    milestoneBig: "",
  };
}

/** Headline for a tone by index (wraps around). 'custom' returns '' so the person's own text is kept. */
export function headlineFor(tone: Tone, index: number): string {
  if (tone === "custom") return "";
  const list = HEADLINES[tone];
  return list[((index % list.length) + list.length) % list.length];
}
export function captionFor(tone: Tone, index: number): string {
  if (tone === "custom") return "";
  const list = CAPTIONS[tone];
  return list[((index % list.length) + list.length) % list.length];
}

/** Default headlines that talk about a single day, with the wording to use when the artwork covers a week. */
const WEEK_HEADLINES: Record<string, string> = {
  "Daily recap": "Weekly recap",
  "What a CGM sees in a day.": "What a CGM sees in a week.",
};
/** Swap a built-in single-day headline for its week wording. Anything the person typed is returned untouched. */
export function headlineForPeriod(
  headline: string,
  period: "day" | "week",
): string {
  return period === "week"
    ? (WEEK_HEADLINES[headline.trim()] ?? headline)
    : headline;
}
