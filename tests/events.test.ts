import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addEvent,
  updateEvent,
  removeEvent,
  eventsInWindow,
  isValidEvent,
  sanitizeEvents,
  newEventId,
  KIND_LABELS,
  eventSummary,
  formatDuration,
  floorTo5,
  startBounds,
  clampStart,
  composeStart,
  shiftDay,
  canShiftDay,
  roundDuration,
  wheelValues,
  fitPaths,
  stripWindow,
  fractionIn,
  hasDuration,
} from "../src/events";
import { loadState, DEFAULT_RANGE, emptyState } from "../src/state";
import type { GlucaEvent, State } from "../src/types";

const ev = (o: Partial<GlucaEvent> = {}): GlucaEvent => ({
  id: "a",
  kind: "meal",
  start: 1_000_000,
  durationMin: 0,
  ...o,
});
const MIN = 60000;

test("isValidEvent checks kind, start, duration and label", () => {
  assert.equal(isValidEvent(ev()), true);
  assert.equal(isValidEvent(ev({ label: "lunch" })), true);
  assert.equal(isValidEvent(ev({ kind: "activity", durationMin: 720 })), true);
  assert.equal(isValidEvent(ev({ id: "" })), false);
  assert.equal(isValidEvent({ ...ev(), kind: "snack" }), false);
  assert.equal(isValidEvent(ev({ start: NaN })), false);
  assert.equal(isValidEvent(ev({ start: Infinity })), false);
  assert.equal(isValidEvent(ev({ durationMin: -1 })), false);
  assert.equal(isValidEvent(ev({ durationMin: 721 })), false);
  assert.equal(isValidEvent(ev({ durationMin: 2.5 })), false);
  assert.equal(isValidEvent(ev({ label: "x".repeat(40) })), true);
  assert.equal(isValidEvent(ev({ label: "x".repeat(41) })), false);
  assert.equal(isValidEvent(ev({ label: "  " + "x".repeat(40) + "  " })), true);
  assert.equal(isValidEvent({ ...ev(), label: 5 }), false);
  assert.equal(isValidEvent(null), false);
  assert.equal(isValidEvent("meal"), false);
});

test("sanitizeEvents drops invalid and repeated entries, trims labels, and tolerates non-lists", () => {
  const out = sanitizeEvents([
    ev({ label: "  walk " }),
    { nope: 1 },
    ev({ id: "b", label: "   " }),
    ev({ start: NaN, id: "c" }),
    ev({ id: "a", kind: "note" }),
  ]);
  assert.deepEqual(out, [
    { id: "a", kind: "meal", start: 1_000_000, durationMin: 0, label: "walk" },
    { id: "b", kind: "meal", start: 1_000_000, durationMin: 0 },
  ]);
  assert.deepEqual(sanitizeEvents(undefined), []);
  assert.deepEqual(sanitizeEvents("x"), []);
  assert.deepEqual(sanitizeEvents({ 0: ev() }), []);
});

test("loadState validates saved events", () => {
  const defaults: State = emptyState();
  const s = loadState(
    JSON.stringify({
      events: [ev(), { id: "x", kind: "meal", start: "soon", durationMin: 0 }],
    }),
    defaults,
  );
  assert.deepEqual(s.events, [ev()]);
  assert.deepEqual(
    loadState(JSON.stringify({ events: "bad" }), defaults).events,
    [],
  );
  assert.deepEqual(
    loadState(JSON.stringify({ unit: "mmol/L" }), defaults).events,
    [],
  );
});

test("add, update and remove work on a state slice without touching the rest", () => {
  const s = { events: [] as GlucaEvent[], other: 1 };
  const a = addEvent(s, ev());
  assert.equal(a.events.length, 1);
  assert.equal(a.other, 1);
  assert.equal(s.events.length, 0, "input is not mutated");
  const u = updateEvent(a, "a", {
    kind: "activity",
    durationMin: 30,
    label: "walk",
  });
  assert.deepEqual(u.events[0], {
    id: "a",
    kind: "activity",
    start: 1_000_000,
    durationMin: 30,
    label: "walk",
  });
  assert.deepEqual(updateEvent(a, "zzz", { durationMin: 5 }).events, a.events);
  assert.deepEqual(removeEvent(u, "a").events, []);
  assert.equal(removeEvent(u, "zzz").events.length, 1);
});

test("eventsInWindow filters by window and sorts by start", () => {
  const events = [
    ev({ id: "late", start: 500 * MIN }),
    ev({ id: "early", start: 100 * MIN }),
    ev({ id: "before", start: 10 * MIN }),
    ev({ id: "run", kind: "activity", start: 80 * MIN, durationMin: 30 }), // ends at 110, overlaps
    ev({ id: "edge", start: 600 * MIN }), // end is exclusive
  ];
  assert.deepEqual(
    eventsInWindow(events, 100 * MIN, 600 * MIN).map((e) => e.id),
    ["run", "early", "late"],
  );
  assert.deepEqual(eventsInWindow([], 0, 1), []);
});

test("newEventId is unique and non-empty", () => {
  const ids = new Set(Array.from({ length: 500 }, () => newEventId()));
  assert.equal(ids.size, 500);
  assert.ok([...ids][0].length > 4);
});

test("labels and summaries use plain words", () => {
  assert.deepEqual(KIND_LABELS, {
    meal: "Meal",
    activity: "Activity",
    note: "Note",
  });
  assert.equal(eventSummary({ kind: "meal", durationMin: 0 }), "Meal");
  assert.equal(
    eventSummary({ kind: "activity", durationMin: 90 }),
    "Activity, 1 h 30 min",
  );
  assert.equal(formatDuration(45), "45 min");
  assert.equal(formatDuration(120), "2 h");
  assert.equal(hasDuration("activity"), true);
  assert.equal(hasDuration("meal"), false);
  assert.equal(hasDuration("note"), false);
});

test("start bounds: last 14 days, never the future, 5-minute steps", () => {
  const now = new Date(2026, 10, 13, 14, 37, 20).getTime();
  const { min, max } = startBounds(now);
  assert.equal(max, new Date(2026, 10, 13, 14, 35).getTime());
  assert.equal(min, new Date(2026, 9, 31, 0, 0).getTime());
  assert.equal(floorTo5(now) % (5 * MIN), 0);
  assert.equal(clampStart(now + 3600000, now), max);
  assert.equal(clampStart(min - 1, now), min);
  assert.equal(
    composeStart(now, 23, 55, now),
    max,
    "a time later today is held at now",
  );
  assert.equal(
    composeStart(now, 9, 5, now),
    new Date(2026, 10, 13, 9, 5).getTime(),
  );
  const y = shiftDay(now, -1, now);
  assert.equal(new Date(y).getDate(), 12);
  assert.equal(canShiftDay(now, 1, now), false);
  assert.equal(canShiftDay(now, -1, now), true);
  assert.equal(canShiftDay(min, -1, now), false);
  assert.equal(canShiftDay(y, 1, now), true);
  assert.equal(shiftDay(now, 1, now), max);
});

test("duration wheel values and rounding", () => {
  const v = wheelValues(5, 240, 5);
  assert.equal(v.length, 48);
  assert.equal(v[0], 5);
  assert.equal(v.at(-1), 240);
  assert.equal(roundDuration(0), 5);
  assert.equal(roundDuration(32), 30);
  assert.equal(roundDuration(600), 240);
});

test("fitPaths keeps gaps as separate paths and fits values into the box", () => {
  // y on the 900x300 canvas for 20..600 mg/dL
  const y = (v: number) => (300 - ((v - 20) / 580) * 300).toFixed(2);
  const paths = [
    `M0,${y(100)} L450,${y(200)} `,
    `M600,${y(150)} L900,${y(150)} `,
  ];
  const out = fitPaths(paths, 300, 100, 100, 200);
  assert.equal(out.length, 2);
  assert.equal(out[0], "M0.0,100.0 L150.0,0.0");
  assert.ok(out[1].startsWith("M200.0,50.0"));
  assert.deepEqual(fitPaths([], 300, 100, 0, 1), []);
});

test("strip window is 6 hours around the time, and the marker fraction is clamped", () => {
  const { from, to } = stripWindow(10_000_000_000);
  assert.equal(to - from, 6 * 3600000);
  assert.equal(fractionIn(10_000_000_000, from, to), 0.5);
  assert.equal(fractionIn(from - 5, from, to), 0);
  assert.equal(fractionIn(to + 5, from, to), 1);
});
