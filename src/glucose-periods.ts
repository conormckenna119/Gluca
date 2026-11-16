// Shared UTC period aggregation, backed by the existing calculation engine. No Dexcom/UI-specific statistics.
import { summarize } from "./analytics";
import type { Reading } from "./types";
import { DAY_MS, type GlucoseWindow } from "./glucose-window";
export function periodSummaries(
  rows: Reading[],
  window: GlucoseWindow,
  kind: "day" | "week",
  low = 70,
  high = 180,
) {
  const base = new Date(window.start);
  base.setUTCHours(0, 0, 0, 0);
  if (kind === "week")
    base.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
  const step = kind === "week" ? 7 * DAY_MS : DAY_MS;
  const out = [];
  // Bounded diagnostics data covers at most 30 days; the limit also protects callers with invalid windows.
  for (
    let start = base.getTime();
    start < window.end && out.length < 32;
    start += step
  ) {
    const end = start + step;
    // Clip observed time to the retrieved interval; coverage still uses the full calendar bucket.
    const stats = summarize(
      rows,
      Math.max(start, window.start),
      Math.min(end, window.end),
      low,
      high,
      "utc",
    );
    out.push({
      start,
      end,
      fullyRequested: start >= window.start && end <= window.end,
      stats: { ...stats, coverage: (stats.covered / (end - start)) * 100 },
    });
  }
  return out;
}
export function utcChartTicks(start: number, end: number) {
  if (!(end > start)) return [];
  return Array.from({ length: 4 }, (_, i) => {
    const t = Math.round(start + ((end - start) * i) / 3);
    return {
      t,
      label: new Date(t)
        .toISOString()
        .slice(end - start > DAY_MS ? 5 : 11, end - start > DAY_MS ? 10 : 16),
    };
  });
}
