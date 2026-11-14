// Tone presets: headline and caption suggestions. Every line is optional and editable.
//
// Rules for this copy: supportive or neutral, never judging a person by a glucose number, no advice about insulin/food/exercise,
// no jokes that reward unsafe management. Educational lines state general facts only and MUST be reviewed against reputable
// sources (e.g. ADA, Dexcom, Diabetes UK) before any public release. See docs/VALIDATION_PLAN.md.

import type { TemplateId } from './telemetry';

export type Tone = 'minimal' | 'humorous' | 'motivational' | 'educational' | 'custom';
export const TONES: Tone[] = ['minimal', 'humorous', 'motivational', 'educational', 'custom'];
export const TONE_LABEL: Record<Tone, string> = { minimal: 'Minimal', humorous: 'Humorous', motivational: 'Motivational', educational: 'Educational', custom: 'Custom' };

export const HEADLINES: Record<Exclude<Tone, 'custom'>, string[]> = {
  minimal: ['', 'My glucose.', 'One line at a time.'],
  humorous: [
    'Pancreas replacement shift.',
    'Another shift completed. No PTO available.',
    'My pancreas chose chaos.',
    'Running on insulin.',
    'Diabetes: the unpaid second job.',
  ],
  motivational: [
    'Progress, not perfection.',
    'Another day of showing up.',
    'Some days are just like this.',
    'Still here. Still showing up.',
    'Stronger than I knew.',
  ],
  educational: [
    'What a CGM sees in a day.',
    'Glucose moves all day long.',
    'Food, activity, sleep, stress: glucose moves with all of it.',
  ],
};

export const CAPTIONS: Record<Exclude<Tone, 'custom'>, string[]> = {
  minimal: [''],
  humorous: [
    'Would not recommend as a hobby. Doing it anyway.',
    'Please hold while the CGM catches up.',
    'Zero stars. Still showing up.',
  ],
  motivational: [
    'Progress, not perfection.',
    'Showing up still counts.',
    'Not every day is a personal best. Showing up still counts.',
  ],
  educational: [
    'A CGM reads glucose in the fluid under the skin, about every 5 minutes.',
    'Time in range is the share of readings between a person’s own target limits.',
    'These are my numbers only. Everyone’s diabetes is different.',
  ],
};

export interface CopyDefaults { tone: Tone; headline: string; caption: string; milestoneBig: string }

export function defaultCopy(template: TemplateId): CopyDefaults {
  switch (template) {
    case 'minimal_trace': return { tone: 'minimal', headline: '', caption: '', milestoneBig: '' };
    case 'daily_recap': return { tone: 'motivational', headline: 'Another day of showing up.', caption: '', milestoneBig: '' };
    case 'transparent_overlay': return { tone: 'minimal', headline: '', caption: '', milestoneBig: '' };
    case 'real_side': return { tone: 'motivational', headline: 'Some days are just like this.', caption: 'Not every day is a personal best. Showing up still counts.', milestoneBig: '' };
    case 'humorous': return { tone: 'humorous', headline: 'Pancreas replacement shift.', caption: 'Would not recommend as a hobby. Doing it anyway.', milestoneBig: '' };
    case 'milestone': return { tone: 'motivational', headline: 'Years of showing up.', caption: 'Stronger than I knew I could be.', milestoneBig: '10 years' };
  }
}

/** Headline for a tone by index (wraps around). 'custom' returns '' so the person's own text is kept. */
export function headlineFor(tone: Tone, index: number): string {
  if (tone === 'custom') return '';
  const list = HEADLINES[tone];
  return list[((index % list.length) + list.length) % list.length];
}
export function captionFor(tone: Tone, index: number): string {
  if (tone === 'custom') return '';
  const list = CAPTIONS[tone];
  return list[((index % list.length) + list.length) % list.length];
}

/** Default headlines that talk about a single day, with the wording to use when the artwork covers a week. */
const WEEK_HEADLINES: Record<string, string> = {
  'Another day of showing up.': 'Another week of showing up.',
  'What a CGM sees in a day.': 'What a CGM sees in a week.',
};
/** Swap a built-in single-day headline for its week wording. Anything the person typed is returned untouched. */
export function headlineForPeriod(headline: string, period: 'day' | 'week'): string {
  return period === 'week' ? WEEK_HEADLINES[headline.trim()] ?? headline : headline;
}
