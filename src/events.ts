// Pure helpers for logged events (meal, activity, note). No React Native imports, so tests can load it.
// An event holds a kind, a time, a duration and an optional short label. It never holds carbohydrate, insulin or dose amounts.
import type { GlucaEvent, State } from "./types";

export const EVENT_KINDS = ["meal", "activity", "note"] as const;
export type EventKind = GlucaEvent["kind"];

export const KIND_LABELS: Record<EventKind, string> = {
  meal: "Meal",
  activity: "Activity",
  note: "Note",
};
export const MAX_LABEL = 40;
export const MAX_DURATION_MIN = 720;
/** Choices on the duration wheel. */
export const WHEEL_DURATION = {
  min: 5,
  max: 240,
  step: 5,
  fallback: 30,
} as const;
export const HISTORY_DAYS = 14;

const MIN = 60000;
const HOUR = 3600000;
export const STEP_MIN = 5;

export const isEventKind = (k: unknown): k is EventKind =>
  (EVENT_KINDS as readonly unknown[]).includes(k);

export function isValidEvent(e: unknown): e is GlucaEvent {
  if (!e || typeof e !== "object") return false;
  const { id, kind, start, durationMin, label } = e as Record<string, unknown>;
  if (typeof id !== "string" || !id) return false;
  if (!isEventKind(kind)) return false;
  if (typeof start !== "number" || !Number.isFinite(start)) return false;
  if (
    typeof durationMin !== "number" ||
    !Number.isInteger(durationMin) ||
    durationMin < 0 ||
    durationMin > MAX_DURATION_MIN
  )
    return false;
  if (
    label !== undefined &&
    (typeof label !== "string" || label.trim().length > MAX_LABEL)
  )
    return false;
  return true;
}

/** Keep the valid saved events (trimmed label, empty label dropped, first of any repeated id). Anything else becomes []. */
export function sanitizeEvents(raw: unknown): GlucaEvent[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: GlucaEvent[] = [];
  for (const e of raw) {
    if (!isValidEvent(e) || seen.has(e.id)) continue;
    seen.add(e.id);
    const label = e.label?.trim();
    const clean: GlucaEvent = {
      id: e.id,
      kind: e.kind,
      start: e.start,
      durationMin: e.durationMin,
    };
    if (label) clean.label = label;
    out.push(clean);
  }
  return out;
}

type Slice = Pick<State, "events">;

export const addEvent = <S extends Slice>(s: S, e: GlucaEvent): S => ({
  ...s,
  events: [...s.events, e],
});

/** Replace fields of the event with this id. An unknown id changes nothing. */
export const updateEvent = <S extends Slice>(
  s: S,
  id: string,
  patch: Partial<Omit<GlucaEvent, "id">>,
): S => ({
  ...s,
  events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
});

export const removeEvent = <S extends Slice>(s: S, id: string): S => ({
  ...s,
  events: s.events.filter((e) => e.id !== id),
});

/** Events in [start, end): a point in time inside it, or an activity whose span overlaps it. Sorted by start. */
export function eventsInWindow(
  events: GlucaEvent[],
  start: number,
  end: number,
): GlucaEvent[] {
  return events
    .filter((e) => e.start < end && e.start + e.durationMin * MIN >= start)
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

let counter = 0;
export function newEventId(): string {
  counter += 1;
  return `ev-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Meals and notes are points in time; only an activity has a length. */
export const hasDuration = (k: EventKind): boolean => k === "activity";

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "Activity, 30 min" or "Meal". No judgement words. */
export const eventSummary = (
  e: Pick<GlucaEvent, "kind" | "durationMin">,
): string =>
  e.kind === "activity" && e.durationMin > 0
    ? `${KIND_LABELS.activity}, ${formatDuration(e.durationMin)}`
    : KIND_LABELS[e.kind];

// ---- Time choosing ----

export const floorTo5 = (t: number): number =>
  Math.floor(t / (STEP_MIN * MIN)) * STEP_MIN * MIN;

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(t: number, days: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Earliest and latest start the person can choose: the last 14 days (today included), never the future. */
export function startBounds(now: number): { min: number; max: number } {
  return {
    min: addDays(startOfDay(now), -(HISTORY_DAYS - 1)),
    max: floorTo5(now),
  };
}

export function clampStart(t: number, now: number): number {
  const { min, max } = startBounds(now);
  return Math.min(max, Math.max(min, t));
}

/** Local day of `t` at the given hour and minute, clamped to the allowed bounds. */
export function composeStart(
  t: number,
  hour: number,
  minute: number,
  now: number,
): number {
  const d = new Date(t);
  d.setHours(hour, minute, 0, 0);
  return clampStart(d.getTime(), now);
}

/** Same time of day, shifted by whole local days, clamped to the allowed bounds. */
export const shiftDay = (t: number, days: number, now: number): number =>
  clampStart(addDays(t, days), now);

export const canShiftDay = (t: number, days: number, now: number): boolean => {
  const { min, max } = startBounds(now);
  const to = startOfDay(addDays(t, days));
  return days < 0 ? to >= min : to <= startOfDay(max);
};

/** Default start for a new event: now, rounded down to 5 minutes. */
export const defaultStart = (now: number): number => floorTo5(now);

export const roundDuration = (min: number): number => {
  const { min: lo, max: hi, step } = WHEEL_DURATION;
  return Math.min(hi, Math.max(lo, Math.round(min / step) * step));
};

export function wheelValues(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max; v += step) out.push(v);
  return out;
}

// ---- Live strip ----

export const STRIP_HOURS = 3; // shown on each side of the chosen time

export function stripWindow(start: number): { from: number; to: number } {
  return { from: start - STRIP_HOURS * HOUR, to: start + STRIP_HOURS * HOUR };
}

/**
 * Fit paths from analytics `segments()` (drawn on a 900 x 300 canvas for 20-600 mg/dL) into a w x h box scaled to
 * vmin..vmax mg/dL. Each segment stays its own path, so a gap in the data stays a gap.
 */
export function fitPaths(
  paths: string[],
  w: number,
  h: number,
  vmin: number,
  vmax: number,
): string[] {
  const span = Math.max(1, vmax - vmin);
  return paths
    .map((d) => {
      const pts = d.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g) ?? [];
      return pts
        .map((p, i) => {
          const [x, y] = p.split(",").map(Number);
          const v = 600 - (y / 300) * 580;
          const nx = (x / 900) * w;
          const ny = h - ((v - vmin) / span) * h;
          return `${i ? "L" : "M"}${nx.toFixed(1)},${ny.toFixed(1)}`;
        })
        .join(" ");
    })
    .filter(Boolean);
}

/** Horizontal position (0 to 1) of a time inside [from, to], clamped. */
export const fractionIn = (t: number, from: number, to: number): number =>
  Math.min(1, Math.max(0, (t - from) / (to - from)));
