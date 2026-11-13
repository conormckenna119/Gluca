// App-facing glucose helpers. The statistics themselves live in src/art/analytics.ts (the only implementation);
// everything here is a thin adapter from the app's Reading ({timestamp, mgdl}, UTC epoch ms) to the engine's
// Reading ({t, mgdl}, wall-clock epoch ms) and back to the shapes the screens already use.
import type { Reading } from "./types";
import { cleanReadings, computeStats, segmentsFor, STEP_MS, VALID_MAX, VALID_MIN, MG_PER_MMOL } from "./art/analytics";

export const FIVE_MINUTES = STEP_MS;
export const convert = (mgdl: number, unit: string) =>
  unit === "mmol/L" ? mgdl / MG_PER_MMOL : mgdl;

/**
 * The single place app timestamps (UTC epoch ms) become engine time. The engine treats a timestamp as wall-clock
 * time ("UTC-as-local"), so a day is the person's own midnight-to-midnight. The offset is taken at each instant, so
 * daylight-saving changes are respected. Convert interval bounds and readings with this, and nothing else.
 */
export const wall = (t: number) => t - new Date(t).getTimezoneOffset() * 60000;

/** Valid readings only (20-600 mg/dL, finite), duplicate timestamps keep the last row, sorted by time. Still UTC. */
export function normalize(readings: Reading[]) {
  const valid = readings.filter(
    (r) =>
      Number.isFinite(r.timestamp) &&
      Number.isFinite(r.mgdl) &&
      r.mgdl >= VALID_MIN &&
      r.mgdl <= VALID_MAX,
  );
  const last = new Map(valid.map((r) => [r.timestamp, r]));
  return [...last.values()].sort((a, b) => a.timestamp - b.timestamp);
}

/** App readings to engine readings: wall-clock time, validated, deduplicated, sorted. */
export function toEngine(rows: Reading[]) {
  return cleanReadings(rows.map((r) => ({ t: wall(r.timestamp), mgdl: r.mgdl }))).readings;
}

/**
 * Statistics for [start, end) (UTC instants). Computed by the engine's computeStats. Percentages are 0-100 here
 * (the engine uses 0-1); `coverage` is observed time / interval and is reported separately from tir/above/below,
 * which use observed time as their denominator. With no observed time every figure is 0, never "in range".
 */
export function summarize(
  input: Reading[],
  start: number,
  end: number,
  low = 70,
  high = 180,
) {
  const s = computeStats(toEngine(input), wall(start), wall(end), { low, high });
  return {
    count: s.readings,
    average: s.avg ?? 0,
    sd: s.sd ?? 0,
    cv: (s.cv ?? 0) * 100,
    tir: (s.tir ?? 0) * 100,
    above: (s.tar ?? 0) * 100,
    below: (s.tbr ?? 0) * 100,
    coverage: s.coverage * 100,
    covered: s.observedMs,
  };
}

/**
 * SVG path strings for [start, end), one per unbroken run; a gap of more than ten minutes starts a new path.
 * Points come from the engine's segmentsFor; only the drawing coordinates (20-600 mg/dL onto width x height) are
 * computed here.
 */
export function segments(
  rows: Reading[],
  start: number,
  end: number,
  width = 900,
  height = 300,
) {
  const ws = wall(start);
  const we = wall(end);
  return segmentsFor(toEngine(rows), ws, we).map((seg) =>
    seg
      .map((p, i) => {
        const x = ((p.t - ws) / (we - ws)) * width;
        const y = height - ((p.v - VALID_MIN) / (VALID_MAX - VALID_MIN)) * height;
        return `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)} `;
      })
      .join(""),
  );
}
