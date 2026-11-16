// Period keys in the person's LOCAL calendar (the device time zone), used to make awards repeatable per period.
// Pure TypeScript.
import type { EvaluationPeriod } from "../domain/achievements";

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO 8601 week of a calendar date: weeks start Monday, week 1 holds the year's first Thursday. */
export function isoWeek(
  year: number,
  month: number,
  day: number,
): { year: number; week: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay() || 7; // Monday 1 .. Sunday 7
  d.setUTCDate(d.getUTCDate() + 4 - dow); // the Thursday of this week decides the ISO year
  const isoYear = d.getUTCFullYear();
  const dayOfYear = Math.floor(
    (d.getTime() - Date.UTC(isoYear, 0, 1)) / 86400000,
  );
  return { year: isoYear, week: Math.floor(dayOfYear / 7) + 1 };
}

/** "" for none, "2026", "2026-11", "2026-Q4", "2026-W47". `date` is epoch ms or a Date, read in local time. */
export function periodKey(
  period: EvaluationPeriod,
  date: number | Date,
): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  switch (period) {
    case "none":
      return "";
    case "year":
      return String(y);
    case "month":
      return `${y}-${pad(m)}`;
    case "quarter":
      return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    case "week": {
      const w = isoWeek(y, m, d.getDate());
      return `${w.year}-W${pad(w.week)}`;
    }
  }
}
