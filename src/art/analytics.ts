// Pure glucose calculations. No UI, no I/O.
//
// Assumptions (also documented in README):
//  - Readings are stored in mg/dL. Display units are a presentation choice.
//  - `t` is a "wall-clock" timestamp: epoch milliseconds of the local date/time exactly as written in the source file,
//    read as if it were UTC. This avoids time-zone and DST guesswork for CSV exports, which carry local time.
//    A "day" is therefore always 24 hours of wall-clock time.
//  - Each reading represents the time from its timestamp until the next reading, capped at 5 minutes (a G7 reading interval).
//    The last reading also counts for at most 5 minutes. Longer gaps are unobserved: they are never counted as in range,
//    and they are never interpolated.
//  - Averages, SD and range percentages are weighted by observed time. Percentages use observed time as the denominator;
//    `coverage` separately reports observed time / total interval.

export type Unit = 'mgdl' | 'mmol';
export interface Reading { t: number; mgdl: number }
export interface TargetRange { low: number; high: number } // mg/dL, inclusive on both ends

export const MG_PER_MMOL = 18.0182;
export const STEP_MS = 5 * 60_000;
export const DAY_MS = 86_400_000;
export const VALID_MIN = 20;
export const VALID_MAX = 600;
export const DEFAULT_RANGE: TargetRange = { low: 70, high: 180 };

export const unitLabel = (u: Unit): string => (u === 'mgdl' ? 'mg/dL' : 'mmol/L');
export const toMmol = (mgdl: number): number => mgdl / MG_PER_MMOL;
export const fromMmol = (mmol: number): number => mmol * MG_PER_MMOL;
export function formatGlucose(mgdl: number, unit: Unit): string {
  return unit === 'mgdl' ? String(Math.round(mgdl)) : toMmol(mgdl).toFixed(1);
}

export function cleanReadings(input: readonly Reading[]): { readings: Reading[]; invalid: number; duplicates: number } {
  const byTime = new Map<number, number>();
  let invalid = 0;
  let duplicates = 0;
  for (const r of input) {
    if (!Number.isFinite(r.t) || !Number.isFinite(r.mgdl) || r.mgdl < VALID_MIN || r.mgdl > VALID_MAX) { invalid++; continue; }
    if (byTime.has(r.t)) duplicates++;
    byTime.set(r.t, r.mgdl); // later rows win, deterministically
  }
  const readings = [...byTime.entries()].map(([t, mgdl]) => ({ t, mgdl })).sort((a, b) => a.t - b.t);
  return { readings, invalid, duplicates };
}

export interface Stats {
  readings: number;       // readings whose timestamp falls inside the interval
  observedMs: number;
  intervalMs: number;
  coverage: number;       // 0..1
  avg: number | null;     // mg/dL
  sd: number | null;
  cv: number | null;      // sd / avg
  min: number | null;
  max: number | null;
  tir: number | null;     // 0..1 of observed time
  tar: number | null;
  tbr: number | null;
}

function lowerBound(rs: readonly Reading[], t: number): number {
  let lo = 0, hi = rs.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (rs[mid].t < t) lo = mid + 1; else hi = mid; }
  return lo;
}

/** `rs` must be the output of cleanReadings (sorted, unique). Interval is [start, end). */
export function computeStats(rs: readonly Reading[], start: number, end: number, range: TargetRange = DEFAULT_RANGE): Stats {
  const intervalMs = Math.max(0, end - start);
  let W = 0, Wv = 0, Wv2 = 0, wIn = 0, wHigh = 0, wLow = 0, count = 0;
  let min = Infinity, max = -Infinity;
  const first = Math.max(0, lowerBound(rs, start - STEP_MS));
  for (let i = first; i < rs.length && rs[i].t < end; i++) {
    const r = rs[i];
    const next = i + 1 < rs.length ? rs[i + 1].t : Infinity;
    const segStart = Math.max(r.t, start);
    const segEnd = Math.min(r.t + Math.min(next - r.t, STEP_MS), end);
    if (r.t >= start) { count++; if (r.mgdl < min) min = r.mgdl; if (r.mgdl > max) max = r.mgdl; }
    const w = segEnd - segStart;
    if (w <= 0) continue;
    W += w; Wv += w * r.mgdl; Wv2 += w * r.mgdl * r.mgdl;
    if (r.mgdl < range.low) wLow += w; else if (r.mgdl > range.high) wHigh += w; else wIn += w;
  }
  if (W === 0) {
    return { readings: count, observedMs: 0, intervalMs, coverage: 0, avg: null, sd: null, cv: null, min: null, max: null, tir: null, tar: null, tbr: null };
  }
  const avg = Wv / W;
  const sd = Math.sqrt(Math.max(0, Wv2 / W - avg * avg));
  return {
    readings: count, observedMs: W, intervalMs, coverage: intervalMs ? W / intervalMs : 0,
    avg, sd, cv: avg ? sd / avg : null,
    min: count ? min : null, max: count ? max : null,
    tir: wIn / W, tar: wHigh / W, tbr: wLow / W,
  };
}

/** Whole-number percentages that always sum to 100 (largest-remainder rounding). */
export function percents3(a: number, b: number, c: number): [number, number, number] {
  const raw = [a, b, c].map((x) => x * 100);
  const floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => ({ i, rem: x - Math.floor(x) })).sort((p, q) => q.rem - p.rem);
  for (const o of order) { if (left <= 0) break; floor[o.i]++; left--; }
  return [floor[0], floor[1], floor[2]];
}

// ---- dates (wall-clock, UTC components) ----
const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (ms: number): string => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export function parseYmd(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return ymd(t) === s ? t : null;
}
export const dayStart = (ms: number): number => Math.floor(ms / DAY_MS) * DAY_MS;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const weekdayShort = (ms: number): string => WEEKDAYS[new Date(ms).getUTCDay()];
export const monthDay = (ms: number): string => `${MONTHS[new Date(ms).getUTCMonth()]} ${new Date(ms).getUTCDate()}`;
export const dayLabel = (ms: number): string => `${weekdayShort(ms)} · ${monthDay(ms)}`;
export function periodLabel(start: number, end: number): string {
  const days = Math.round((end - start) / DAY_MS);
  return days <= 1 ? dayLabel(start) : `${monthDay(start)} – ${monthDay(end - DAY_MS)}`;
}

export interface DaySummary { date: string; start: number; end: number; stats: Stats }
/** One entry per calendar day from the first to the last reading (days with no data included, coverage 0). */
export function summarizeDays(rs: readonly Reading[], range: TargetRange = DEFAULT_RANGE): DaySummary[] {
  if (!rs.length) return [];
  const out: DaySummary[] = [];
  for (let s = dayStart(rs[0].t); s <= rs[rs.length - 1].t; s += DAY_MS) {
    out.push({ date: ymd(s), start: s, end: s + DAY_MS, stats: computeStats(rs, s, s + DAY_MS, range) });
  }
  return out;
}

// ---- chart helpers ----
export interface Pt { t: number; v: number }
/** Points inside [start, end), split wherever consecutive readings are more than `maxGapMs` apart. Gaps are never bridged. */
export function segmentsFor(rs: readonly Reading[], start: number, end: number, maxGapMs = 10 * 60_000): Pt[][] {
  const segs: Pt[][] = [];
  let cur: Pt[] = [];
  for (let i = lowerBound(rs, start); i < rs.length && rs[i].t < end; i++) {
    const r = rs[i];
    if (cur.length && r.t - cur[cur.length - 1].t > maxGapMs) { segs.push(cur); cur = []; }
    cur.push({ t: r.t, v: r.mgdl });
  }
  if (cur.length) segs.push(cur);
  return segs;
}
/** Gap edges (the last point before and first point after each break), for drawing "no data" markers. */
export function gapEdges(segs: readonly Pt[][]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < segs.length; i++) out.push([segs[i][segs[i].length - 1].t, segs[i + 1][0].t]);
  return out;
}
