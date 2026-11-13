import { Reading } from "./types";
export const FIVE_MINUTES = 300000;
export const convert = (mgdl: number, unit: string) =>
  unit === "mmol/L" ? mgdl / 18.0182 : mgdl;
export function normalize(readings: Reading[]) {
  return [
    ...new Map(
      readings
        .filter(
          (r) =>
            Number.isFinite(r.timestamp) &&
            Number.isFinite(r.mgdl) &&
            r.mgdl >= 20 &&
            r.mgdl <= 600,
        )
        .map((r) => [r.timestamp, r]),
    ).values(),
  ].sort((a, b) => a.timestamp - b.timestamp);
}
/** Forward step estimates, capped at five minutes. Unknown time is never in range.
 * Caller supplies explicit UTC instants for the selected interval. No interpolation across gaps. */
export function summarize(
  input: Reading[],
  start: number,
  end: number,
  low = 70,
  high = 180,
) {
  const all = normalize(input);
  const rows = all.filter((r) => r.timestamp >= start && r.timestamp < end);
  let covered = 0,
    inside = 0,
    above = 0,
    below = 0,
    sum = 0,
    sum2 = 0;
  for (let i = 0; i < all.length; i++) {
    const r = all[i];
    const t = Math.max(
      0,
      Math.min(
        end,
        all[i + 1]?.timestamp ?? r.timestamp + FIVE_MINUTES,
        r.timestamp + FIVE_MINUTES,
      ) - Math.max(start, r.timestamp),
    );
    if (!t) continue;
    covered += t;
    sum += r.mgdl * t;
    sum2 += r.mgdl * r.mgdl * t;
    if (r.mgdl < low) below += t;
    else if (r.mgdl > high) above += t;
    else inside += t;
  }
  const average = covered ? sum / covered : 0;
  const sd = covered
    ? Math.sqrt(Math.max(0, sum2 / covered - average * average))
    : 0;
  return {
    count: rows.length,
    average,
    sd,
    cv: average ? (sd / average) * 100 : 0,
    tir: covered ? (inside / covered) * 100 : 0,
    above: covered ? (above / covered) * 100 : 0,
    below: covered ? (below / covered) * 100 : 0,
    coverage: end > start ? (covered / (end - start)) * 100 : 0,
    covered,
  };
}
export function segments(
  rows: Reading[],
  start: number,
  end: number,
  width = 900,
  height = 300,
) {
  const groups: string[] = [];
  let path = "";
  let prev = 0;
  normalize(rows)
    .filter((r) => r.timestamp >= start && r.timestamp < end)
    .forEach((r) => {
      const x = ((r.timestamp - start) / (end - start)) * width;
    const y = height - ((r.mgdl - 20) / 580) * height;
      if (r.timestamp - prev > FIVE_MINUTES * 1.5 && path) {
        groups.push(path);
        path = "";
      }
      path += `${path ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)} `;
      prev = r.timestamp;
    });
  if (path) groups.push(path);
  return groups;
}
