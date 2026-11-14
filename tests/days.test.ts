import { test } from "node:test";
import assert from "node:assert/strict";
import {
  daysWithData,
  dayOf,
  stepDay,
  dayLabel,
  countByDay,
  anchorForDay,
} from "../src/days";

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m, d, h, min).getTime();

test("dayOf returns local midnight", () => {
  assert.equal(dayOf(at(2026, 10, 12, 23, 59)), at(2026, 10, 12));
  assert.equal(dayOf(at(2026, 10, 12, 0, 0)), at(2026, 10, 12));
});

test("daysWithData dedupes and sorts, with a gap day left out", () => {
  const days = daysWithData([
    at(2026, 10, 12, 18),
    at(2026, 10, 9, 7),
    at(2026, 10, 12, 1),
    at(2026, 10, 9, 22),
  ]);
  assert.deepEqual(days, [at(2026, 10, 9), at(2026, 10, 12)]);
  assert.deepEqual(daysWithData([]), []);
});

test("stepDay skips gaps and returns null at the ends", () => {
  const days = [at(2026, 10, 9), at(2026, 10, 12), at(2026, 10, 13)];
  assert.equal(stepDay(days, at(2026, 10, 12), -1), at(2026, 10, 9));
  assert.equal(stepDay(days, at(2026, 10, 9), 1), at(2026, 10, 12));
  assert.equal(stepDay(days, at(2026, 10, 9), -1), null);
  assert.equal(stepDay(days, at(2026, 10, 13), 1), null);
  assert.equal(stepDay(days, at(2026, 10, 10), 1), at(2026, 10, 12));
  assert.equal(stepDay([], at(2026, 10, 10), 1), null);
});

test("dayLabel is words, countByDay counts, anchor is noon", () => {
  assert.equal(dayLabel(at(2026, 10, 12, 15)), "Thu 12 Nov");
  const m = countByDay([
    at(2026, 10, 12, 1),
    at(2026, 10, 12, 2),
    at(2026, 10, 9),
  ]);
  assert.equal(m.get(at(2026, 10, 12)), 2);
  assert.equal(m.get(at(2026, 10, 9)), 1);
  assert.equal(dayOf(anchorForDay(at(2026, 10, 12))), at(2026, 10, 12));
  assert.equal(new Date(anchorForDay(at(2026, 10, 12))).getHours(), 12);
});
