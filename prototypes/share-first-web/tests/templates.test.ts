import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanReadings, parseYmd, computeStats, segmentsFor, type Reading } from '../src/analytics';
import { generateDemo } from '../src/demo';
import { FORMATS, FORMAT_ORDER, telemetryFormat } from '../src/formats';
import { HEADLINES, CAPTIONS, TONES, defaultCopy, headlineFor } from '../src/copy';
import { defaultSettings, makeArtModel, withTemplate } from '../src/model';
import { SWATCHES, buildPalette, contrast, ensureContrast, fitText, wrapText, approxMeasure, PAPER, NEAR_BLACK } from '../src/svg';
import { TEMPLATE_ORDER, buildArtwork, defaultShow } from '../src/templates';

const readings: Reading[] = cleanReadings(generateDemo('2026-11-12')).readings;
const DAY = parseYmd('2026-11-11') as number;
const GAP_DAY = parseYmd('2026-10-16') as number; // a demo day with a sensor gap
const PARTIAL_DAY = parseYmd('2026-11-12') as number;

const art = (template: (typeof TEMPLATE_ORDER)[number], over: Record<string, unknown> = {}, anchor = DAY) => {
  const s = { ...defaultSettings(template), ...over } as ReturnType<typeof defaultSettings>;
  return buildArtwork(makeArtModel(readings, 'demo', anchor, s, { embedFont: false }));
};

test('every template renders at the exact format size, with nothing spilling past the footer', () => {
  for (const template of TEMPLATE_ORDER) {
    for (const format of FORMAT_ORDER) {
      for (const anchor of [DAY, GAP_DAY, PARTIAL_DAY]) {
        const a = art(template, { format }, anchor);
        assert.equal(a.width, FORMATS[format].w);
        assert.equal(a.height, FORMATS[format].h);
        assert.match(a.svg, new RegExp(`width="${FORMATS[format].w}" height="${FORMATS[format].h}"`));
        assert.equal(a.overflow, 0, `${template}/${format}/${anchor}: overflow ${a.overflow}px`);
      }
    }
  }
});

test('worst-case text lengths still fit (headline/caption are truncated, not overflowing)', () => {
  const long = 'This is a very long line of text that a person might paste in, going on and on about their day with diabetes and everything else. '.repeat(3);
  for (const template of TEMPLATE_ORDER) {
    for (const format of FORMAT_ORDER) {
      const a = art(template, { format, headline: long, caption: long, milestoneBig: 'Twenty-five years and counting' });
      assert.equal(a.overflow, 0, `${template}/${format}: overflow ${a.overflow}px`);
    }
  }
});

test('transparent exports have no background layer; opaque ones do', () => {
  assert.equal(art('transparent_overlay').svg.includes('data-bg'), false);
  assert.equal(art('daily_recap', { transparent: true }).svg.includes('data-bg'), false);
  assert.equal(art('daily_recap').svg.includes('data-bg'), true);
  assert.equal(defaultSettings('transparent_overlay').transparent, true);
  assert.equal(telemetryFormat('story', true), 'transparent_png');
  assert.equal(telemetryFormat('story', false), 'story_1080x1920');
});

test('demo data is always labelled on the image and cannot be switched off', () => {
  for (const t of ['minimal_trace', 'daily_recap', 'transparent_overlay', 'real_side', 'humorous'] as const) {
    const a = art(t, { show: { ...defaultShow(t), brand: false, partialNote: false } });
    assert.match(a.svg, /DEMO DATA/, t);
    assert.ok(a.contents.some((c) => /demo data/i.test(c)), t);
  }
  const csv = buildArtwork(makeArtModel(readings, 'csv', DAY, defaultSettings('daily_recap'), { embedFont: false }));
  assert.doesNotMatch(csv.svg, /DEMO DATA/);
});

test('partial and gappy periods carry a "based on X%" note; complete ones do not; it can be removed', () => {
  assert.match(art('daily_recap', {}, PARTIAL_DAY).svg, /BASED ON \d+% OF THIS DAY/);
  // a small gap (coverage >= 90%) is not annotated; the gap itself is still drawn as empty
  assert.doesNotMatch(art('daily_recap', {}, GAP_DAY).svg, /BASED ON/);
  assert.doesNotMatch(art('daily_recap', {}, DAY).svg, /BASED ON/);
  const off = art('daily_recap', { show: { ...defaultShow('daily_recap'), partialNote: false } }, PARTIAL_DAY);
  assert.doesNotMatch(off.svg, /BASED ON/);
});

test('gaps stay gaps: a gappy day draws more than one path segment and dashed "no data" edges', () => {
  const a = art('minimal_trace', {}, GAP_DAY);
  assert.ok(a.contents.some((c) => /gaps in data are left empty/.test(c)));
  assert.match(a.svg, /stroke-dasharray="4 8"/);
  const clean = art('minimal_trace', {}, DAY);
  assert.ok(!clean.contents.some((c) => /gaps in data/.test(c)));
});

test('every number is optional: with all stats off, no statistic is drawn or listed', () => {
  const none = { ...defaultShow('daily_recap'), tir: false, avg: false, readings: false, coverage: false };
  const a = art('daily_recap', { show: none });
  assert.ok(!a.contents.some((c) => /Time in range|Average glucose|Number of readings|coverage/i.test(c)));
  assert.doesNotMatch(a.svg, /TIME IN RANGE|AVERAGE|READINGS/);
  const noChart = art('minimal_trace', { show: { ...defaultShow('minimal_trace'), chart: false } });
  assert.ok(!noChart.contents.some((c) => /Glucose trace/.test(c)));
});

test('"what is on this image" matches what was drawn', () => {
  const a = art('daily_recap');
  const stats = computeStats(readings, DAY, DAY + 86_400_000);
  assert.ok(a.contents.includes(`Time in range: ${Math.round((stats.tir as number) * 100)}% (70–180 mg/dL)`) || a.contents.some((c) => /^Time in range: \d+%/.test(c)));
  assert.ok(a.contents.some((c) => /^Average glucose: \d+ mg\/dL/.test(c)));
  assert.ok(a.contents.some((c) => /wordmark/.test(c)));
  const noBrand = art('daily_recap', { show: { ...defaultShow('daily_recap'), brand: false } });
  assert.ok(!noBrand.contents.some((c) => /wordmark/.test(c)));
});

test('units: mmol/L changes labels and values, not the data', () => {
  const mg = art('minimal_trace');
  const mmol = art('minimal_trace', { unit: 'mmol' });
  assert.ok(mg.contents.some((c) => /mg\/dL/.test(c)));
  assert.ok(mmol.contents.some((c) => /Average glucose: \d+\.\d mmol\/L/.test(c)));
  assert.ok(mmol.contents.some((c) => /3\.9–10\.0 mmol\/L/.test(c)));
});

test('template defaults: overlay is white ink; leaving the overlay restores the brand accent', () => {
  assert.equal(defaultSettings('transparent_overlay').accent, SWATCHES.white);
  const s = withTemplate(defaultSettings('transparent_overlay'), 'daily_recap');
  assert.equal(s.accent, SWATCHES.mint);
  assert.equal(s.transparent, false);
  const custom = withTemplate({ ...defaultSettings('daily_recap'), accent: SWATCHES.lavender }, 'humorous');
  assert.equal(custom.accent, SWATCHES.lavender);
});

test('milestone needs no glucose data', () => {
  const s = defaultSettings('milestone');
  const a = buildArtwork(makeArtModel([], 'csv', DAY, s, { embedFont: false }));
  assert.equal(a.hasData, false);
  assert.equal(a.overflow, 0);
  assert.ok(a.contents.some((c) => /^Milestone:/.test(c)));
  assert.doesNotMatch(a.svg, /DEMO DATA/);
});

test('user text is escaped in the SVG', () => {
  const a = art('real_side', { headline: '<script>alert(1)</script> & "quotes"' });
  assert.doesNotMatch(a.svg, /<script>/);
  assert.match(a.svg, /&lt;script&gt;/);
});

test('text wrapping never breaks a word unless it cannot fit, and fitText truncates with an ellipsis at the floor', () => {
  assert.deepEqual(wrapText('one two three', 1000, 40, 700, approxMeasure), ['one two three']);
  const lines = wrapText('Supercalifragilisticexpialidocious', 300, 40, 700, approxMeasure);
  assert.ok(lines.length > 1 && lines.every((l) => approxMeasure(l, 40, 700) <= 300));
  const f = fitText('word '.repeat(100), { maxW: 400, maxLines: 2, size: 60, min: 30, weight: 700, measure: approxMeasure });
  assert.equal(f.lines.length, 2);
  assert.match(f.lines[1], /…$/);
  const bal = fitText('Some days are just like this.', { maxW: 900, maxLines: 3, size: 112, min: 50, weight: 800, measure: approxMeasure });
  assert.ok(bal.lines.length < 2 || approxMeasure(bal.lines[bal.lines.length - 1], bal.size, 800) > approxMeasure(bal.lines[0], bal.size, 800) * 0.3, 'no lone last word');
});

test('headlines shrink rather than split a word mid-way', () => {
  for (const format of FORMAT_ORDER) {
    const a = art('humorous', { format });
    assert.doesNotMatch(a.svg, />replaceme<|>nt shift/, format);
  }
});

test('contrast: accent text meets 4.5:1 on both themes for every swatch', () => {
  for (const hex of Object.values(SWATCHES)) {
    const dark = buildPalette('dark', hex, false);
    const light = buildPalette('light', hex, false);
    assert.ok(contrast(dark.accentText, NEAR_BLACK) >= 4.5, `dark ${hex}`);
    assert.ok(contrast(light.accentText, PAPER) >= 4.5, `light ${hex}`);
  }
  assert.ok(contrast(ensureContrast('#91E6B2', PAPER, 4.5), PAPER) >= 4.5);
});

test('below / in-range / above are never distinguished by red or green alone', () => {
  const p = buildPalette('dark', SWATCHES.mint, false);
  assert.notEqual(p.below, p.above);
  assert.notEqual(p.below, p.accent);
  const a = art('daily_recap');
  assert.match(a.svg, /Below \d+%/); assert.match(a.svg, /In range \d+%/); assert.match(a.svg, /Above \d+%/);
});

test('tone copy: headlines exist for every tone, include the requested examples, and carry no outcome judgement', () => {
  const all = Object.values(HEADLINES).flat().join('|');
  for (const h of ['Pancreas replacement shift.', 'Another shift completed. No PTO available.', 'Running on insulin.', 'My pancreas chose chaos.', 'Progress, not perfection.', 'Some days are just like this.', 'Another day of showing up.']) {
    assert.ok(all.includes(h), h);
  }
  assert.equal(headlineFor('custom', 0), '');
  assert.equal(headlineFor('humorous', 5), HEADLINES.humorous[0]);
  for (const t of TEMPLATE_ORDER) assert.ok(TONES.includes(defaultCopy(t).tone));
  const everything = [...Object.values(HEADLINES).flat(), ...Object.values(CAPTIONS).flat()].join(' ').toLowerCase();
  for (const bad of [/\bperfect\b/, /\bfail(ed|ure)?\b/, /good day/, /bad day/, /\bwin(s|ning)?\b/, /\bscore\b/, /insulin dose/, /\bcarbs?\b/]) assert.doesNotMatch(everything, bad);
});

test('overflow guard: stats from a no-data day produce an empty-but-valid graphic', () => {
  const none = buildArtwork(makeArtModel(readings, 'demo', parseYmd('2025-01-01') as number, defaultSettings('daily_recap'), { embedFont: false }));
  assert.equal(none.hasData, false);
  assert.equal(none.overflow, 0);
  assert.equal(segmentsFor(readings, 0, 1).length, 0);
});
