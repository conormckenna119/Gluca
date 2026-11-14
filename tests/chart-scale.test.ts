import { test } from "node:test";
import assert from "node:assert/strict";
import {
  yScale,
  timeTicks,
  remapPath,
  rangeStatus,
  formatAgo,
  chartSummary,
  formatGlucose,
} from "../src/chart-scale";

test("yScale contains the band and every reading, with a minimum span", () => {
  const s = yScale([95, 110, 102], 70, 180, "mg/dL");
  assert.ok(s.min <= 70 && s.max >= 180);
  const flat = yScale([], 70, 180, "mg/dL");
  assert.ok(flat.max - flat.min >= 100);
  const high = yScale([60, 340], 70, 180, "mg/dL");
  assert.ok(high.min <= 60 && high.max >= 340);
  assert.ok(high.min >= 0);
});

test("yScale ticks are rounded, ascending, within the domain", () => {
  const s = yScale([88, 260], 70, 180, "mg/dL");
  assert.ok(s.ticks.length >= 3 && s.ticks.length <= 7);
  assert.equal(s.ticks[0].mgdl, s.min);
  assert.ok(s.ticks.at(-1)!.mgdl <= s.max + 1e-6);
  for (let i = 1; i < s.ticks.length; i++)
    assert.ok(s.ticks[i].mgdl > s.ticks[i - 1].mgdl);
});

test("yScale in mmol/L labels in display units and still contains data", () => {
  const s = yScale([70, 300], 70, 180, "mmol/L");
  assert.ok(s.min <= 70 && s.max >= 300);
  assert.match(s.ticks[0].label, /^\d+\.\d$/);
  assert.equal(formatGlucose(180.182, "mmol/L"), "10.0");
  assert.ok(
    yScale([], 70, 180, "mmol/L").max - yScale([], 70, 180, "mmol/L").min >=
      100 - 1e-6,
  );
});

test("timeTicks: hours for a day, days for longer", () => {
  const start = new Date(2026, 10, 12, 0, 0, 0).getTime();
  const day = timeTicks(start, start + 24 * 3600000);
  assert.ok(day.length >= 4 && day.length <= 7);
  assert.equal(day[0].label, "00:00");
  assert.ok(day.every((t) => t.t >= start && t.t <= start + 24 * 3600000));
  const three = timeTicks(start + 5 * 60000, start + 3 * 3600000);
  assert.ok(three.length >= 2 && three.every((t) => /^\d\d:00$/.test(t.label)));
  const week = timeTicks(start, start + 7 * 86400000);
  assert.ok(week.length >= 4 && week.length <= 8);
  assert.match(week[0].label, /^12 Nov$/);
  const month = timeTicks(start, start + 30 * 86400000);
  assert.ok(month.length <= 7);
  assert.deepEqual(timeTicks(5, 5), []);
});

test("remapPath keeps breaks and maps y into the new domain", () => {
  const d = "M0.00,300.00 L900.00,0.00 ";
  const out = remapPath(
    d,
    { w: 900, h: 300 },
    { x: 40, y: 0, w: 800, h: 200 },
    { min: 20, max: 600 },
  );
  assert.equal(out, "M40.00,200.00 L840.00,0.00");
  const narrow = remapPath(
    "M450.00,150.00",
    { w: 900, h: 300 },
    { x: 0, y: 0, w: 100, h: 100 },
    { min: 0, max: 310 },
  );
  // 150/300 -> 310 mg/dL midpoint of 20..600 is 310 -> top of domain
  assert.equal(narrow, "M50.00,0.00");
});

test("rangeStatus, formatAgo and chartSummary", () => {
  assert.equal(rangeStatus(65, 70, 180), "below");
  assert.equal(rangeStatus(70, 70, 180), "in");
  assert.equal(rangeStatus(181, 70, 180), "above");
  assert.equal(formatAgo(0, 12 * 60000), "12 min ago");
  assert.equal(formatAgo(0, 20000), "just now");
  assert.equal(formatAgo(0, 3 * 3600000), "3 h ago");
  assert.equal(formatAgo(0, 2 * 86400000), "2 days ago");
  const s = chartSummary({
    periodLabel: "24 hours",
    count: 0,
    coveragePct: 0,
    low: 70,
    high: 180,
    unit: "mg/dL",
  });
  assert.match(s, /No readings/);
  const t = chartSummary({
    periodLabel: "24 hours",
    count: 10,
    coveragePct: 50,
    minMgdl: 80,
    maxMgdl: 200,
    low: 70,
    high: 180,
    unit: "mg/dL",
  });
  assert.match(t, /50 percent coverage/);
  assert.match(t, /80 to 200 mg\/dL/);
});
