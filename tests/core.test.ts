import { test } from "node:test";
import assert from "node:assert/strict";
import { convert, summarize, normalize, segments } from "../src/analytics";
import { parseCsv } from "../src/csv";
import {
  MockGlucoseProvider,
  CsvGlucoseProvider,
  DexcomGlucoseProvider,
  synthetic,
} from "../src/providers";
import { formats, storyArtwork, defaultOptions, switchTemplate, nativeSafe, templateIds } from "../src/story";
import type { Reading } from "../src/types";
import { PEAK_PATH, DROP_PATH, SWATCHES, peakColor, contrast, buildPalette } from "../src/art/svg";
const minute = 60000;
const r = (t: number, v: number): Reading => ({
  timestamp: t * minute,
  mgdl: v,
  source: "mock",
});
test("conversion retains underlying precision", () => {
  assert.equal(convert(180.182, "mmol/L"), 10);
  assert.equal(convert(100, "mg/dL"), 100);
});
test("weighted average, range and variability reflect covered intervals", () => {
  const s = summarize([r(0, 50), r(5, 100), r(10, 200)], 0, 15 * minute);
  assert.equal(s.count, 3);
  assert.equal(s.coverage, 100);
  assert.ok(Math.abs(s.tir - 100 / 3) < 1e-10);
  assert.ok(Math.abs(s.average - 350 / 3) < 1e-10);
  assert.ok(Math.abs(s.sd - 62.360956) < 0.0001);
  assert.ok(s.cv > 50);
});
test("missing time is excluded and partial days stay incomplete", () => {
  const s = summarize([r(0, 100), r(60, 100)], 0, 24 * 60 * minute);
  assert.equal(s.covered, 10 * minute);
  assert.ok(s.coverage < 1);
  assert.equal(s.tir, 100);
  assert.equal(segments([r(0, 100), r(60, 100)], 0, 120 * minute).length, 2);
});
test("irregular intervals clip at boundaries and do not overlap", () => {
  const s = summarize([r(0, 100), r(2, 200), r(4, 50)], minute, 5 * minute);
  assert.equal(s.covered, 4 * minute);
  assert.equal(s.average, 137.5);
  assert.equal(s.tir, 25);
});
test("duplicates are deterministic, invalid readings excluded", () => {
  const rows = normalize([r(5, 90), r(0, 100), r(0, 110), r(1, NaN)]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].mgdl, 110);
});
test("empty and reversed intervals have zero coverage", () => {
  assert.equal(summarize([], 0, minute).coverage, 0);
  assert.equal(summarize([r(0, 100)], minute, 0).coverage, 0);
});
test("CSV preamble, quotes, units, deduplication and invalid rows", () => {
  const csv =
    'Export metadata\nTimestamp,Glucose Value (mg/dL)\n"2026-11-01T01:30:00-04:00",100\n2026-11-01T01:30:00-05:00,120\n2026-11-01T01:30:00-05:00,120\nbad,NOPE';
  const p = parseCsv(csv);
  assert.equal(p.readings.length, 2);
  assert.equal(p.readings[1].timestamp - p.readings[0].timestamp, 3600000);
  assert.equal(p.duplicates, 1);
  assert.equal(p.errors.length, 1);
});
test("CSV locale selection and explicit offset", () => {
  const badDates = parseCsv(
    "Timestamp,Glucose (mg/dL)\n2026-02-30T12:00:00Z,100\n11/12/2026 8:00 AM,100",
  );
  assert.equal(badDates.readings.length, 0);
  assert.equal(badDates.errors.length, 2);
  const p = parseCsv(
    'Device Timestamp;Glucose (mmol/L)\n12/11/2026 08:00;"5,5"',
    "DMY",
    "+01:00",
  );
  assert.equal(p.readings[0].timestamp, Date.parse("2026-11-12T07:00:00Z"));
  assert.ok(Math.abs(p.readings[0].mgdl - 99.1001) < 0.001);
  assert.throws(() => parseCsv("Timestamp,Glucose\n2026-01-01,100"), /units/);
});
test("provider window boundaries and unconnected adapters", async () => {
  const csv = new CsvGlucoseProvider([r(0, 100), r(5, 120)]);
  assert.equal((await csv.getReadings(0, 5 * minute)).length, 1);
  const mock = new MockGlucoseProvider([r(0, 100)]);
  assert.equal((await mock.getReadings(0, minute)).length, 1);
  await assert.rejects(DexcomGlucoseProvider().getReadings(), /not connected/);
});
test("synthetic month has realistic gaps and stable values", () => {
  const rows = synthetic(Date.parse("2026-11-12T12:00:00Z"));
  assert.ok(rows.length > 8000);
  assert.ok(rows.at(-1)!.timestamp - rows[0].timestamp > 30 * 86400000);
  assert.ok(rows.every((x) => x.mgdl >= 20 && x.mgdl <= 600));
});
test("every template renders at its exact export size without overflowing the footer", () => {
  const rows = synthetic(Date.parse("2026-11-12T20:00:00"));
  const anchor = Date.parse("2026-11-11T12:00:00");
  for (const template of templateIds) {
    for (const format of Object.keys(formats) as (keyof typeof formats)[]) {
      const [w, h] = formats[format];
      const o = { ...defaultOptions(template, "mg/dL", format), caption: "A caption that is quite a bit longer than anyone would normally write on a story" };
      const art = storyArtwork(rows, anchor, o);
      assert.equal(art.width, w);
      assert.equal(art.height, h);
      assert.match(art.svg, new RegExp(`width="${w}" height="${h}"`));
      assert.equal(art.overflow, 0, `${template}/${format} overflows by ${art.overflow}px`);
    }
  }
});
test("transparent artwork has no background layer, text is escaped, demo data is labelled", () => {
  const rows = synthetic(Date.parse("2026-11-12T20:00:00"));
  const anchor = Date.parse("2026-11-11T12:00:00");
  const o = { ...defaultOptions("transparent_overlay"), headline: "<script>" };
  const svg = storyArtwork(rows, anchor, o).svg;
  assert.ok(!svg.includes("data-bg"));
  assert.ok(svg.includes("&lt;script&gt;") && !svg.includes("<script>"));
  assert.match(svg, /DEMO DATA/);
  const opaque = storyArtwork(rows, anchor, switchTemplate(o, "daily_recap")).svg;
  assert.ok(opaque.includes("data-bg"));
});
test("native-safe SVG drops filters, styles and font lists that react-native-svg cannot render", () => {
  const rows = synthetic(Date.parse("2026-11-12T20:00:00"));
  const anchor = Date.parse("2026-11-11T12:00:00");
  const svg = storyArtwork(rows, anchor, defaultOptions("daily_recap"), { native: true }).svg;
  assert.ok(!/<filter|filter="url|<style|font-family=/.test(svg));
  assert.ok(svg.includes("<path"));
  assert.equal(nativeSafe('<g filter="url(#sh)"/>'), "<g/>");
});
test("a day with no readings yields a valid empty-state graphic", () => {
  const art = storyArtwork([], Date.parse("2026-11-11T12:00:00"), defaultOptions("daily_recap"));
  assert.equal(art.hasData, false);
  assert.equal(art.overflow, 0);
});
test("brand mark carries the peak path when show.brand is on and not when it is off", () => {
  const rows = synthetic(Date.parse("2026-11-12T20:00:00"));
  const anchor = Date.parse("2026-11-11T12:00:00");
  for (const template of templateIds) {
    const on = defaultOptions(template);
    on.show = { ...on.show, brand: true };
    const off = { ...on, show: { ...on.show, brand: false } };
    const withMark = storyArtwork(rows, anchor, on);
    assert.ok(withMark.svg.includes(`d="${PEAK_PATH}"`), `${template} is missing the peak`);
    assert.ok(withMark.svg.includes(`d="${DROP_PATH}"`));
    assert.equal(withMark.overflow, 0);
    const without = storyArtwork(rows, anchor, off);
    assert.ok(!without.svg.includes(PEAK_PATH) && !without.svg.includes(DROP_PATH), `${template} shows the mark with brand off`);
  }
});
test("the peak line contrasts with the drop for every swatch, opaque and transparent", () => {
  for (const accent of Object.values(SWATCHES)) {
    for (const transparent of [false, true]) {
      const p = buildPalette("dark", accent, transparent);
      assert.ok(contrast(peakColor(p), p.accent) >= 3, `${accent} transparent=${transparent}`);
    }
  }
});
