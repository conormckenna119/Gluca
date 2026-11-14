import { relativeTime } from "../src/time";
import assert from "node:assert/strict";
import { test } from "node:test";

const now = new Date(2026, 10, 13, 12, 0, 0).getTime();
const ago = (ms: number) => relativeTime(now - ms, now);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

test("relativeTime buckets", () => {
  assert.equal(ago(10_000), "just now");
  assert.equal(ago(-5000), "just now");
  assert.equal(ago(12 * MIN), "12 min ago");
  assert.equal(ago(3 * HOUR + 5 * MIN), "3 h ago");
  assert.equal(ago(30 * HOUR), "yesterday");
  assert.equal(ago(4 * DAY), "4 days ago");
});

test("relativeTime falls back to a short date", () => {
  assert.equal(ago(10 * DAY), "3 Nov");
  assert.match(ago(400 * DAY), /^\d{1,2} \w{3} 2025$/);
});
