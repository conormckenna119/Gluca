// Glue between data + user settings and the artwork engine. Pure; shared by the web app, scripts and tests.

import { DAY_MS, DEFAULT_RANGE, computeStats, dayStart, segmentsFor, type Reading, type TargetRange, type Unit } from './analytics';
import { defaultCopy, headlineForPeriod, type Tone } from './copy';
import type { FormatId } from './formats';
import { SWATCHES, type ArtEvent, type Measure } from './svg';
import { TEMPLATE_INFO, defaultShow, type ArtModel, type ShowOptions } from './templates';
import type { TemplateId } from './telemetry';

export type PeriodKind = 'day' | 'week';

export interface Settings {
  template: TemplateId;
  format: FormatId;
  transparent: boolean;
  theme: 'dark' | 'light';
  accent: string;
  unit: Unit;
  range: TargetRange;
  tone: Tone;
  headline: string;
  caption: string;
  milestoneBig: string;
  show: ShowOptions;
  period: PeriodKind;
}

export function defaultSettings(template: TemplateId = 'daily_recap'): Settings {
  const c = defaultCopy(template);
  return {
    template, format: 'story', transparent: TEMPLATE_INFO[template].transparentByDefault, theme: 'dark',
    accent: template === 'transparent_overlay' ? SWATCHES.white : SWATCHES.mint, // white reads best over most photos
    unit: 'mgdl', range: { ...DEFAULT_RANGE }, tone: c.tone, headline: c.headline, caption: c.caption, milestoneBig: c.milestoneBig,
    show: defaultShow(template), period: 'day',
  };
}

/** Switching template keeps look-and-feel choices (theme, accent, unit, range, format) but resets the words and toggles to that template's defaults. */
export function withTemplate(s: Settings, template: TemplateId): Settings {
  const d = defaultSettings(template);
  // entering the overlay selects white ink; leaving it restores the brand accent (unless the person picked another colour)
  const accent = template === 'transparent_overlay' ? SWATCHES.white : s.template === 'transparent_overlay' && s.accent === SWATCHES.white ? SWATCHES.mint : s.accent;
  return { ...d, format: s.format, theme: s.theme, accent, unit: s.unit, range: s.range, period: s.period };
}

export function periodBounds(kind: PeriodKind, anyMsInAnchorDay: number): { start: number; end: number } {
  const d = dayStart(anyMsInAnchorDay);
  return kind === 'day' ? { start: d, end: d + DAY_MS } : { start: d - 6 * DAY_MS, end: d + DAY_MS };
}

export function makeArtModel(readings: readonly Reading[], source: 'demo' | 'csv' | 'dexcom-sandbox', anchorMs: number, s: Settings, o: { embedFont: boolean; measure?: Measure; events?: ArtEvent[] }): ArtModel {
  const { start, end } = periodBounds(s.period, anchorMs);
  return {
    template: s.template, format: s.format, transparent: s.transparent, theme: s.theme, accent: s.accent, unit: s.unit, range: s.range, source,
    start, end, stats: computeStats(readings, start, end, s.range), segs: segmentsFor(readings, start, end),
    headline: headlineForPeriod(s.headline, s.period), caption: s.caption, milestoneBig: s.milestoneBig, show: s.show, embedFont: o.embedFont, measure: o.measure,
    ...(o.events && o.events.length ? { events: o.events } : {}),
  };
}
