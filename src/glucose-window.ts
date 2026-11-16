// Shared transport contract and interval rules. No I/O, credentials, React or persistence.
import type { DexcomReading } from "./types";
export const DAY_MS = 86400000;
export const MAX_GLUCOSE_WINDOW_MS = 30 * DAY_MS;
export type GlucoseWindow = { start: number; end: number }; // UTC epoch milliseconds, [start,end)
export type AvailableGlucoseRange = {
  start: number;
  end: number;
  sourceStart: string;
  sourceEnd: string;
}; // last sample inclusive
export interface DexcomRangeResult {
  source: "dexcom";
  environment: "sandbox";
  range: AvailableGlucoseRange | null;
  connectionRevision: string;
}
export interface DexcomDataResult {
  source: "dexcom";
  environment: "sandbox";
  readings: DexcomReading[];
  window: GlucoseWindow;
  range: AvailableGlucoseRange | null;
  connectionRevision: string;
  retrievedAt: number;
  receivedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  outsideWindowCount: number;
}
export const isEpoch = (t: unknown): t is number =>
  typeof t === "number" &&
  Number.isSafeInteger(t) &&
  t >= 0 &&
  t < 253402300799999;
export function validWindow(w: GlucoseWindow) {
  return (
    isEpoch(w.start) &&
    isEpoch(w.end) &&
    w.end > w.start &&
    w.end - w.start <= MAX_GLUCOSE_WINDOW_MS
  );
}
/** Select by actual available history, never by today's date. End includes the latest sample, with ms precision. */
export function latestWindow(
  range: AvailableGlucoseRange,
  days = 1,
): GlucoseWindow {
  if (
    !isEpoch(range.start) ||
    !isEpoch(range.end) ||
    range.end < range.start ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 30
  )
    throw new Error("bad_range");
  const end = range.end + 1;
  return { start: Math.max(range.start, end - days * DAY_MS), end };
}
export function intersectWindow(
  w: GlucoseWindow,
  range: AvailableGlucoseRange,
): GlucoseWindow | null {
  if (!validWindow(w)) throw new Error("bad_range");
  const start = Math.max(w.start, range.start),
    end = Math.min(w.end, range.end + 1);
  return end > start ? { start, end } : null;
}
/** Strict UTC/system-time parsing; missing zone means UTC per Dexcom, never the host timezone. */
export function parseProviderTime(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:?\d{2})?$/.exec(
      v,
    );
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (
    +y < 1970 ||
    +mo < 1 ||
    +mo > 12 ||
    +d < 1 ||
    +d > new Date(Date.UTC(+y, +mo, 0)).getUTCDate() ||
    +h > 23 ||
    +mi > 59 ||
    +s > 59
  )
    return null;
  const n = Date.parse(m[8] ? v : `${v}Z`);
  return isEpoch(n) ? n : null;
}
