// Diabetes experience shield. Pure TypeScript (no React Native) so it can be tested.
// The shield marks time since diagnosis, self-reported and optional. It is not a ranking and says nothing
// about how well anyone manages diabetes. All dates are the person's local calendar dates.
import { isValidPartialDate, type PartialDate } from "./profile";

export type LocalDate = { year: number; month: number; day: number };

/** Legacy ornament metadata retained for compatibility; the simplified shield no longer renders these marks. */
export type ShieldGlyph =
  | "dot"
  | "ring"
  | "bar"
  | "chevron"
  | "diamond"
  | "triangle"
  | "square"
  | "spark"
  | "hexagon"
  | "star";

export type ShieldTierId =
  | "teal"
  | "silver"
  | "bronze"
  | "gold"
  | "amethyst"
  | "sapphire"
  | "emerald"
  | "platinum"
  | "diamond"
  | "legacy";

export type ShieldTier = {
  id: ShieldTierId;
  label: string;
  minYears: number;
  mark: ShieldGlyph;
};

export const SHIELD_TIERS: readonly ShieldTier[] = [
  { id: "teal", label: "teal", minYears: 0, mark: "dot" },
  { id: "silver", label: "silver", minYears: 1, mark: "ring" },
  { id: "bronze", label: "bronze", minYears: 5, mark: "bar" },
  { id: "gold", label: "gold", minYears: 10, mark: "chevron" },
  { id: "amethyst", label: "amethyst", minYears: 15, mark: "diamond" },
  { id: "sapphire", label: "sapphire", minYears: 20, mark: "triangle" },
  { id: "emerald", label: "emerald", minYears: 25, mark: "square" },
  { id: "platinum", label: "platinum", minYears: 30, mark: "spark" },
  { id: "diamond", label: "diamond", minYears: 40, mark: "hexagon" },
  { id: "legacy", label: "legacy", minYears: 50, mark: "star" },
];

export function tierForYears(years: number): ShieldTier {
  let t = SHIELD_TIERS[0];
  for (const x of SHIELD_TIERS) if (years >= x.minYears) t = x;
  return t;
}

export const tierById = (id: string): ShieldTier | undefined =>
  SHIELD_TIERS.find((t) => t.id === id);

/** The person's local calendar date. Uses local getters, never UTC arithmetic. */
export function localToday(now: Date = new Date()): LocalDate {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const cmp = (a: LocalDate, b: LocalDate) =>
  a.year - b.year || a.month - b.month || a.day - b.day;

/** The day an exact anniversary falls in `year`. A 29 February diagnosis counts on 1 March in non-leap years. */
function anniversaryIn(month: number, day: number, year: number): LocalDate {
  if (month === 2 && day === 29 && !isLeap(year))
    return { year, month: 3, day: 1 };
  return { year, month, day };
}

export type CompletedYears = { years: number; certain: boolean };

/**
 * Completed years since diagnosis, never over-counted and never negative.
 * - Exact date: the year completes on the anniversary day (29 Feb: 1 March in non-leap years).
 * - Month and year: no day is invented. A year counts only once the whole anniversary month has passed
 *   (from the first of the following month); during the anniversary month `certain` is false.
 * - Year only: the conservative count `today.year - year - 1` (never below 0), `certain: false` once the
 *   diagnosis year is over, because the anniversary may not have happened yet this year.
 * - `approximate: true` is always `certain: false`.
 * - A diagnosis in the future, or a malformed date, gives null.
 */
export function completedYears(
  diagnosis: PartialDate,
  today: LocalDate,
): CompletedYears | null {
  if (!isValidPartialDate(diagnosis)) return null;
  const { year, month, day } = diagnosis;
  const approx = diagnosis.approximate === true;
  let years: number;
  let certain: boolean;
  if (month !== undefined && day !== undefined) {
    const start: LocalDate = { year, month, day };
    if (cmp(start, today) > 0) return null;
    years = today.year - year;
    if (cmp(anniversaryIn(month, day, today.year), today) > 0) years -= 1;
    certain = true;
  } else if (month !== undefined) {
    if (year > today.year || (year === today.year && month > today.month))
      return null;
    years = today.year - year;
    if (today.month <= month) years -= 1;
    // Inside the anniversary month of a later year the real day is unknown, so the count may be one short.
    certain = !(today.year > year && today.month === month);
  } else {
    if (year > today.year) return null;
    years = today.year - year - 1;
    certain = today.year === year;
  }
  return { years: Math.max(0, years), certain: certain && !approx };
}

export type ShieldInfo = { tier: ShieldTier; years: number; certain: boolean };

export function shieldFor(
  diagnosis: PartialDate | undefined,
  today: LocalDate,
): ShieldInfo | null {
  if (!diagnosis) return null;
  const done = completedYears(diagnosis, today);
  return done ? { tier: tierForYears(done.years), ...done } : null;
}

/** The next local date on which the count goes up, or null when the day is not known exactly. */
export function nextAnniversary(
  diagnosis: PartialDate | undefined,
  today: LocalDate,
): LocalDate | null {
  if (
    !diagnosis ||
    diagnosis.approximate ||
    diagnosis.month === undefined ||
    diagnosis.day === undefined
  )
    return null;
  if (!completedYears(diagnosis, today)) return null;
  const { month, day } = diagnosis;
  const thisYear = anniversaryIn(month, day, today.year);
  if (cmp(thisYear, today) > 0 && today.year > diagnosis.year) return thisYear;
  const first = anniversaryIn(month, day, diagnosis.year + 1);
  if (cmp(first, today) > 0) return first;
  return anniversaryIn(month, day, today.year + 1);
}

/** The sentence a screen reader says. `showNumber` false (or an unknown count) leaves the number out. */
export function shieldLabel(
  tier: ShieldTier | string,
  years?: number,
  certain = true,
  showNumber = true,
): string {
  const t = typeof tier === "string" ? tierById(tier) : tier;
  const base = `Years with diabetes, ${t ? t.label : "unknown"} shield style`;
  if (!showNumber || years === undefined) return base;
  const n = `${years} ${years === 1 ? "year" : "years"}`;
  return certain ? `${base}, ${n}` : `${base}, ${n}, limited date precision`;
}

/** Explains uncertainty without exposing any private date value in public identity UI. */
export function shieldPrecisionNote(
  diagnosis?: PartialDate,
  certain = true,
): string {
  if (diagnosis?.approximate)
    return "Your diagnosis date is marked as an estimate, so the count is an estimate too. No exact anniversary is assumed.";
  if (diagnosis && diagnosis.month === undefined)
    return "Only a diagnosis year is known. The count is conservative and updates at the start of the next calendar year; no anniversary date is assumed.";
  if (diagnosis && diagnosis.day === undefined)
    return "Only a diagnosis month and year are known. The count increases after the whole anniversary month has passed; no day is assumed.";
  return certain
    ? "Completed years based on a self-reported diagnosis date."
    : "The diagnosis date is partial or estimated. Missing date parts are never filled in; partial dates use a conservative count and estimated dates give an estimated count.";
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const formatLocalDate = (d: LocalDate): string =>
  `${d.day} ${MONTHS[d.month - 1]} ${d.year}`;
