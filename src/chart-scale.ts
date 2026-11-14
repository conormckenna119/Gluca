// Pure scale helpers for the My Glucose chart. Values stay in mg/dL; only labels are converted for display.
import { MG_PER_MMOL } from "./art/analytics";

export type DisplayUnit = "mg/dL" | "mmol/L";
export type YTick = { mgdl: number; label: string };
export type YScale = { min: number; max: number; ticks: YTick[] };
export type TimeTick = { t: number; label: string };

const factor = (unit: string) => (unit === "mmol/L" ? MG_PER_MMOL : 1);
const decimals = (unit: string) => (unit === "mmol/L" ? 1 : 0);

/** Format a mg/dL value in the display unit (no unit suffix). */
export function formatGlucose(mgdl: number, unit: string): string {
  return (mgdl / factor(unit)).toFixed(decimals(unit));
}

/** Smallest "nice" step (1, 2, 2.5, 5 x 10^n) that gives at most `maxTicks` intervals across `span`. */
export function niceStep(span: number, maxTicks: number): number {
  const raw = span / Math.max(1, maxTicks);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= raw - 1e-9) return m * pow;
  return 10 * pow;
}

/**
 * Padded, rounded y domain. Always contains the target band and every reading, never goes below 0,
 * and spans at least 100 mg/dL (5.5 mmol/L) so a flat trace is not stretched into noise.
 */
export function yScale(
  values: number[],
  low: number,
  high: number,
  unit: string,
  maxTicks = 5,
): YScale {
  const f = factor(unit);
  const finite = values.filter((v) => Number.isFinite(v));
  const lo = Math.min(low, ...finite) / f;
  const hi = Math.max(high, ...finite) / f;
  const minSpan = 100 / f;
  let min = lo - (hi - lo) * 0.08;
  let max = hi + (hi - lo) * 0.08;
  if (max - min < minSpan) {
    const mid = (max + min) / 2;
    min = mid - minSpan / 2;
    max = mid + minSpan / 2;
  }
  const step = niceStep(max - min, maxTicks);
  min = Math.max(0, Math.floor(min / step + 1e-9) * step);
  max = Math.ceil(max / step - 1e-9) * step;
  const ticks: YTick[] = [];
  for (let v = min; v <= max + step / 1000; v += step) {
    ticks.push({ mgdl: v * f, label: v.toFixed(decimals(unit)) });
  }
  return { min: min * f, max: max * f, ticks };
}

const HOUR = 3600000;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Local-time tick labels: "14:00" for periods up to a day, "12 Nov" for longer ones. */
export function timeTicks(
  start: number,
  end: number,
  maxTicks = 6,
): TimeTick[] {
  const spanH = (end - start) / HOUR;
  if (!(spanH > 0)) return [];
  const out: TimeTick[] = [];
  if (spanH <= 24) {
    const steps = [1, 2, 3, 4, 6, 12];
    const step = steps.find((s) => spanH / s <= maxTicks) ?? 12;
    const d = new Date(start);
    d.setMinutes(0, 0, 0);
    if (d.getTime() < start) d.setHours(d.getHours() + 1);
    // Align to the step in local hours.
    while (d.getHours() % step !== 0) d.setHours(d.getHours() + 1);
    for (; d.getTime() <= end; d.setHours(d.getHours() + step)) {
      out.push({
        t: d.getTime(),
        label: `${String(d.getHours()).padStart(2, "0")}:00`,
      });
    }
  } else {
    const spanD = spanH / 24;
    const steps = [1, 2, 3, 7, 14];
    const step = steps.find((s) => spanD / s <= maxTicks) ?? 14;
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() < start) d.setDate(d.getDate() + 1);
    for (; d.getTime() <= end; d.setDate(d.getDate() + step)) {
      out.push({
        t: d.getTime(),
        label: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
      });
    }
  }
  return out;
}

/**
 * Re-map a path made by `segments()` (x 0..srcW, y 20-600 mg/dL onto srcH) into a plot rectangle with this
 * y domain. Breaks (separate paths) are untouched, so gaps stay gaps.
 */
export function remapPath(
  d: string,
  src: { w: number; h: number },
  plot: { x: number; y: number; w: number; h: number },
  domain: { min: number; max: number },
): string {
  const VMIN = 20;
  const VMAX = 600;
  return d
    .trim()
    .split(/(?=[ML])/)
    .map((part) => {
      const cmd = part[0];
      const [sx, sy] = part.slice(1).trim().split(",").map(Number);
      const mgdl = VMIN + ((src.h - sy) / src.h) * (VMAX - VMIN);
      const x = plot.x + (sx / src.w) * plot.w;
      const y =
        plot.y +
        plot.h -
        ((mgdl - domain.min) / (domain.max - domain.min)) * plot.h;
      return `${cmd}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export type RangeStatus = "below" | "in" | "above";
export function rangeStatus(
  mgdl: number,
  low: number,
  high: number,
): RangeStatus {
  return mgdl < low ? "below" : mgdl > high ? "above" : "in";
}
export const STATUS_WORDS: Record<RangeStatus, string> = {
  below: "Below your target range",
  in: "In your target range",
  above: "Above your target range",
};

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function formatAgo(thenMs: number, nowMs: number): string {
  const min = Math.max(0, Math.round((nowMs - thenMs) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** One-sentence description of the chart for screen readers. */
export function chartSummary(o: {
  periodLabel: string;
  count: number;
  coveragePct: number;
  minMgdl?: number;
  maxMgdl?: number;
  low: number;
  high: number;
  unit: string;
}): string {
  if (!o.count)
    return `Glucose chart for ${o.periodLabel}. No readings in this period.`;
  const range =
    o.minMgdl !== undefined && o.maxMgdl !== undefined
      ? ` Readings ran from ${formatGlucose(o.minMgdl, o.unit)} to ${formatGlucose(o.maxMgdl, o.unit)} ${o.unit}.`
      : "";
  return (
    `Glucose chart for ${o.periodLabel}. ${o.count} readings, ${o.coveragePct.toFixed(0)} percent coverage.${range}` +
    ` Target range ${formatGlucose(o.low, o.unit)} to ${formatGlucose(o.high, o.unit)} ${o.unit}. Gaps in the line are missing data.`
  );
}
