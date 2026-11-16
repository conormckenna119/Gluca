// Eligibility gate for health milestones (docs/ACHIEVEMENT_SAFETY.md section 3). Pure TypeScript.
// Reason codes are for tests and private diagnostics only. Nothing here produces user-facing text: not qualifying
// is silent, so this module deliberately exports no message, label or description for a reason.
// All glucose statistics come from `summarize` in src/analytics.ts (the single implementation); no maths here.
import type { FlagState } from "../flags";
import type { Reading } from "../types";
import type { Profile, PrivacySettings } from "../domain/profile";
import { summarize } from "../analytics";

export const REASON_CODES = [
  "not_opted_in",
  "not_adult_confirmed",
  "gestational",
  "period_not_complete",
  "period_not_settled",
  "coverage_low",
  "days_low_coverage",
  "range_changed",
  "mixed_sources",
  "demo_data",
  "below_70_high",
  "below_54_high",
  "severe_low_recorded",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const MIN_COVERAGE_PCT = 90;
export const MIN_DAY_COVERAGE_PCT = 70;
export const MIN_GOOD_DAYS = 26;
export const MAX_BELOW_70_PCT = 4;
export const MAX_BELOW_54_PCT = 1;
export const SETTLE_MS = 48 * 3600 * 1000;

export type RangeSpan = { from: number; low: number; high: number };
export type PeriodSource = "demo" | "csv" | "dexcom" | "mixed" | "none";

export type CheckInput = {
  readings: Reading[];
  /** Local calendar month: start inclusive, end exclusive (epoch ms). */
  periodStart: number;
  periodEnd: number;
  now: number;
  /** The range in force now (mg/dL). */
  range: { low: number; high: number };
  /** Optional: the range in force from each instant on, oldest first. Absent today: only the current range is stored. */
  rangeHistory?: RangeSpan[];
  profile: Pick<Profile, "ageConfirmed" | "diabetesType">;
  privacy: Pick<PrivacySettings, "healthAchievements">;
  flags: Pick<FlagState, "healthAchievements">;
  /** True only in prototype mode: synthetic demo data may then produce a (labelled) medal. */
  prototypeDemo: boolean;
  /** Epoch ms of severe lows the person recorded. Undefined: Gluca cannot record these yet. */
  severeLows?: number[];
  /** "baseline": the comparison month. It skips the low-glucose and severe-low guards (a baseline may have lows). */
  role?: "target" | "baseline";
};

export type PeriodStats = {
  tir: number;
  below70: number;
  below54: number;
  coverage: number;
  source: PeriodSource;
  rangeLow: number;
  rangeHigh: number;
  rangeHistory: "available" | "not_available";
  severeLow: "none" | "not_available";
};

export type PeriodCheck = {
  eligible: boolean;
  reasons: ReasonCode[];
  stats?: PeriodStats;
};

/** Source of the readings inside [start, end). */
export function sourceOf(
  readings: Reading[],
  start: number,
  end: number,
): PeriodSource {
  const kinds = new Set<string>();
  for (const r of readings)
    if (r.timestamp >= start && r.timestamp < end) kinds.add(r.source);
  if (kinds.size === 0) return "none";
  if (kinds.size > 1) return "mixed";
  const k = [...kinds][0];
  return k === "mock" ? "demo" : (k as "csv" | "dexcom");
}

/** True when any range in force during the period differs from the current one. */
export function rangeChanged(
  history: RangeSpan[] | undefined,
  start: number,
  end: number,
  range: { low: number; high: number },
): boolean {
  if (!history || history.length === 0) return false;
  const h = [...history].sort((a, b) => a.from - b.from);
  return h.some((span, i) => {
    const until = i + 1 < h.length ? h[i + 1].from : Infinity;
    const overlaps = span.from < end && until > start;
    return overlaps && (span.low !== range.low || span.high !== range.high);
  });
}

/** Days of the period (local midnight to midnight) that have at least 70% coverage. */
export function goodDays(readings: Reading[], start: number, end: number) {
  let good = 0;
  const first = new Date(start);
  for (
    let d = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    d.getTime() < end;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  ) {
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const day = summarize(readings, d.getTime(), next.getTime());
    if (day.coverage >= MIN_DAY_COVERAGE_PCT) good++;
  }
  return good;
}

/**
 * Every line of the gate as an independent check. Returns all reasons that apply, so a test can pin each line.
 * Callers must treat a non-empty `reasons` as "do nothing": no message, no hint, no partial credit.
 */
export function checkPeriod(input: CheckInput): PeriodCheck {
  const { periodStart: s, periodEnd: e, now, range } = input;
  const baseline = input.role === "baseline";
  const reasons: ReasonCode[] = [];
  const add = (c: ReasonCode, bad: boolean) => {
    if (bad) reasons.push(c);
  };

  // 1. Opt-in and flags.
  add(
    "not_opted_in",
    !input.flags.healthAchievements || !input.privacy.healthAchievements,
  );
  // 2. General adult thresholds only.
  add("not_adult_confirmed", input.profile.ageConfirmed !== true);
  add("gestational", input.profile.diabetesType === "gestational");
  // 3. Completed and settled period.
  add("period_not_complete", now < e);
  add("period_not_settled", now >= e && now < e + SETTLE_MS);

  // 4. Coverage (duration-weighted, from the analytics engine; gaps are never in range).
  const main = summarize(input.readings, s, e, range.low, range.high);
  add("coverage_low", main.coverage < MIN_COVERAGE_PCT);
  add("days_low_coverage", goodDays(input.readings, s, e) < MIN_GOOD_DAYS);
  // 5. One comparable definition.
  add("range_changed", rangeChanged(input.rangeHistory, s, e, range));
  // 6. One real source.
  const source = sourceOf(input.readings, s, e);
  add("mixed_sources", source === "mixed");
  add("demo_data", source === "demo" && !input.prototypeDemo);

  // 7. Low-glucose guard. Fixed thresholds of 70 and 54 mg/dL: `summarize` reports time below its `low` argument,
  // so the 70 and 54 figures come from calling it with those lows (still the analytics engine, no own maths).
  const below70 = summarize(input.readings, s, e, 70, range.high).below;
  const below54 = summarize(input.readings, s, e, 54, range.high).below;
  // 8. Severe hypoglycaemia: no way to record one yet, so "not_available" unless the caller supplies them.
  const severe = (input.severeLows ?? []).some((t) => t >= s && t < e);
  if (!baseline) {
    add("below_70_high", below70 >= MAX_BELOW_70_PCT);
    add("below_54_high", below54 >= MAX_BELOW_54_PCT);
    add("severe_low_recorded", severe);
  }

  const stats: PeriodStats = {
    tir: main.tir,
    below70,
    below54,
    coverage: main.coverage,
    source,
    rangeLow: range.low,
    rangeHigh: range.high,
    rangeHistory: input.rangeHistory ? "available" : "not_available",
    severeLow: input.severeLows ? "none" : "not_available",
  };
  return { eligible: reasons.length === 0, reasons, stats };
}
