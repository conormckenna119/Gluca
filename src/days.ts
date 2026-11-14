// Pure helpers for choosing a day that has readings. No React, no react-native.

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
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

/** Local midnight (ms) of the day containing `ms`. */
export function dayOf(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Sorted local-midnight ms of every day that has at least one reading. */
export function daysWithData(timestamps: number[]): number[] {
  const set = new Set<number>();
  for (const t of timestamps) if (Number.isFinite(t)) set.add(dayOf(t));
  return [...set].sort((a, b) => a - b);
}

/** Number of readings on each day (keyed by local-midnight ms). */
export function countByDay(timestamps: number[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const t of timestamps) {
    if (!Number.isFinite(t)) continue;
    const k = dayOf(t);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

/** Previous (-1) or next (1) day that has data, or null at the ends. `days` must be sorted ascending. */
export function stepDay(
  days: number[],
  currentDay: number,
  dir: -1 | 1,
): number | null {
  if (dir === -1) {
    for (let i = days.length - 1; i >= 0; i--)
      if (days[i] < currentDay) return days[i];
    return null;
  }
  for (const d of days) if (d > currentDay) return d;
  return null;
}

/** "Thu 12 Nov" (local time, English, independent of device locale). */
export function dayLabel(ms: number): string {
  const d = new Date(ms);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

/** Anchor to report for a chosen day: noon, so the day is unambiguous across time changes. */
export function anchorForDay(dayStart: number): number {
  return dayStart + 12 * 60 * 60 * 1000;
}
