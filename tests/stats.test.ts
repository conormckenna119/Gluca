import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, segments, normalize, wall } from "../src/analytics";
import { computeStats, cleanReadings } from "../src/art/analytics";
import { storyArtwork, defaultOptions } from "../src/story";
import type { Reading } from "../src/types";

const minute = 60000;
const r = (t: number, v: number): Reading => ({ timestamp: t * minute, mgdl: v, source: "mock" });

test("forward step is capped at 5 minutes", () => {
  const s = summarize([r(0, 100), r(30, 100)], 0, 60 * minute);
  assert.equal(s.covered, 10 * minute); // two readings, 5 minutes each, not 30 + 5
});

test("the last reading counts 5 minutes", () => {
  const s = summarize([r(0, 100)], 0, 60 * minute);
  assert.equal(s.covered, 5 * minute);
  assert.equal(s.count, 1);
});

test("time in range uses observed time as its denominator; coverage is separate", () => {
  const s = summarize([r(0, 100), r(5, 100)], 0, 100 * minute);
  assert.equal(s.tir, 100);
  assert.equal(s.coverage, 10);
  assert.equal(s.above + s.below, 0);
});

test("no observed time is never in range", () => {
  const s = summarize([], 0, 60 * minute);
  assert.equal(s.tir, 0);
  assert.equal(s.average, 0);
  assert.equal(s.coverage, 0);
});

test("gaps over 10 minutes break the line, 10 minutes or less do not", () => {
  assert.equal(segments([r(0, 100), r(10, 100), r(20, 100)], 0, 60 * minute).length, 1);
  assert.equal(segments([r(0, 100), r(11, 100)], 0, 60 * minute).length, 2);
});

test("valid range is 20-600 mg/dL inclusive", () => {
  const rows = normalize([r(0, 19), r(1, 20), r(2, 600), r(3, 601)]);
  assert.deepEqual(rows.map((x) => x.mgdl), [20, 600]);
  assert.equal(summarize([r(0, 19), r(1, 601)], 0, 10 * minute).count, 0);
});

test("duplicate timestamps keep the last row", () => {
  assert.equal(normalize([r(0, 100), r(0, 150)])[0].mgdl, 150);
  assert.equal(summarize([r(0, 100), r(0, 150)], 0, 5 * minute).average, 150);
  assert.equal(cleanReadings([{ t: 0, mgdl: 100 }, { t: 0, mgdl: 150 }]).readings[0].mgdl, 150);
});

test("wall() is the one UTC-to-wall-clock conversion and uses the offset at that instant", () => {
  const t = Date.UTC(2026, 6, 1, 12);
  assert.equal(wall(t), t - new Date(t).getTimezoneOffset() * minute);
  const local = new Date(2026, 6, 1, 12);
  assert.equal(wall(local.getTime()), Date.UTC(2026, 6, 1, 12)); // local clock time becomes the same UTC components
});

test("My Glucose (summarize) and Create (storyArtwork) agree on time in range and average", () => {
  // A synthetic local day with a gap, a high stretch and a low stretch.
  const dayStart = new Date(2026, 10, 11).getTime();
  const rows: Reading[] = [];
  for (let m = 0; m < 24 * 60; m += 5) {
    if (m >= 600 && m < 700) continue; // gap
    const v = m < 240 ? 60 : m < 480 ? 120 + (m % 30) : m < 900 ? 200 : 100;
    rows.push({ timestamp: dayStart + m * minute, mgdl: v, source: "mock" });
  }
  const dayEnd = new Date(2026, 10, 12).getTime();
  const mine = summarize(rows, dayStart, dayEnd, 70, 180);

  const o = { ...defaultOptions("daily_recap"), range: { low: 70, high: 180 } };
  const art = storyArtwork(rows, dayStart + 12 * 60 * minute, o);
  const tirText = art.contents.find((c) => c.startsWith("Time in range:"));
  const avgText = art.contents.find((c) => c.startsWith("Average glucose:"));
  assert.ok(tirText && avgText, art.contents.join(" | "));
  assert.match(tirText, new RegExp(`^Time in range: ${Math.round(mine.tir)}%`));
  assert.match(avgText, new RegExp(`^Average glucose: ${Math.round(mine.average)} mg/dL`));

  // And at full precision against the engine stats the Create path computes.
  const engine = computeStats(
    cleanReadings(rows.map((x) => ({ t: wall(x.timestamp), mgdl: x.mgdl }))).readings,
    wall(dayStart),
    wall(dayStart) + 24 * 60 * minute,
    { low: 70, high: 180 },
  );
  assert.equal(mine.tir, engine.tir! * 100);
  assert.equal(mine.average, engine.avg);
  assert.equal(mine.coverage, engine.coverage * 100);
  assert.ok(mine.coverage < 100 && mine.coverage > 90);
});
