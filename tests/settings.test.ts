import { test } from "node:test";
import assert from "node:assert/strict";
import { loadState, parseRange, rangeToText, DEFAULT_RANGE } from "../src/state";
import { storyArtwork, defaultOptions } from "../src/story";
import type { Reading, State } from "../src/types";

const defaults: State = {
  posts: [], following: [], clubs: [], blocked: [], reports: [], unit: "mg/dL",
  range: { ...DEFAULT_RANGE }, dark: true, imported: [], seenWelcome: false,
};

test("old saved state without range loads with 70/180 and keeps its other fields", () => {
  const old = JSON.stringify({ unit: "mmol/L", dark: false, following: ["Sam Rivera"], posts: [], clubs: [], blocked: [], reports: [], imported: [] });
  const s = loadState(old, defaults);
  assert.deepEqual(s.range, { low: 70, high: 180 });
  assert.equal(s.unit, "mmol/L");
  assert.equal(s.dark, false);
  assert.deepEqual(s.following, ["Sam Rivera"]);
});

test("a valid saved range is kept", () => {
  assert.deepEqual(loadState(JSON.stringify({ range: { low: 80, high: 160 } }), defaults).range, { low: 80, high: 160 });
});

test("corrupt saved ranges fall back to the default", () => {
  for (const bad of [{ low: "70", high: 180 }, { low: 180, high: 70 }, { low: 70, high: 70 }, { low: 10, high: 180 }, { low: 70, high: 700 }, { low: null, high: null }, null, 5, {}, { low: NaN, high: 180 }]) {
    assert.deepEqual(loadState(JSON.stringify({ range: bad, unit: "mmol/L" }), defaults).range, { low: 70, high: 180 }, JSON.stringify(bad));
  }
  assert.equal(loadState("{not json", defaults), defaults);
  assert.equal(loadState(null, defaults), defaults);
});

test("range text converts for display only and rejects invalid input", () => {
  assert.equal(rangeToText(180, "mmol/L"), "10.0");
  assert.equal(rangeToText(70, "mg/dL"), "70");
  assert.deepEqual(parseRange("3.9", "10", "mmol/L"), { low: 70, high: 180 });
  assert.deepEqual(parseRange("80", "150", "mg/dL"), { low: 80, high: 150 });
  assert.equal(parseRange("150", "80", "mg/dL"), null);
  assert.equal(parseRange("", "180", "mg/dL"), null);
  assert.equal(parseRange("abc", "180", "mg/dL"), null);
  assert.equal(parseRange("1", "10", "mmol/L"), null); // 18 mg/dL is below 20
});

test("Create artwork honours a non-default range and mmol/L", () => {
  const day = new Date(2026, 5, 10, 12).getTime();
  const rows: Reading[] = Array.from({ length: 288 }, (_, i) => ({
    timestamp: new Date(2026, 5, 10).getTime() + i * 300000, mgdl: 100 + (i % 60), source: "mock" as const,
  }));
  const base = defaultOptions("daily_recap", "mg/dL");
  const a = storyArtwork(rows, day, base);
  const b = storyArtwork(rows, day, { ...base, unit: "mmol/L", range: { low: 90, high: 126 } });
  const text = (x: { svg: string; contents?: unknown }) => x.svg + JSON.stringify(x.contents ?? "");
  assert.notEqual(a.svg, b.svg);
  assert.match(text(b), /mmol\/L/);
  assert.match(text(b), /5\.0/); // 90 mg/dL
  assert.match(text(b), /7\.0/); // 126 mg/dL
  assert.doesNotMatch(text(a), /mmol\/L/);
});
