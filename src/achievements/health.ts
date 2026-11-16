// Health milestones (docs/ACHIEVEMENT_SAFETY.md sections 3 and 4). Prototype: safetyReview "pending", so they
// exist only while the `healthAchievements` flag is on. Private by default, retrospective, silent when not met.
// Pure TypeScript. Statistics come from the eligibility module, which uses the analytics engine.
import type { AchievementDef } from "../domain/achievements";
import type { Reading } from "../types";
import type { Rule, RuleContext, RuleResult } from "./engine";
import { periodKey } from "./period";
import {
  SETTLE_MS,
  checkPeriod,
  type CheckInput,
  type PeriodStats,
  type RangeSpan,
} from "./eligibility";

const base: Omit<
  AchievementDef,
  "id" | "name" | "description" | "icon" | "repeatable"
> = {
  category: "health",
  requiredData: ["glucose"],
  period: "month",
  minCoveragePct: 90,
  defaultVisibility: "private",
  ruleVersion: 1,
  safetyReview: "pending",
  flag: "healthAchievements",
  needsHealthOptIn: true,
};

export const TIR_MILESTONE: AchievementDef = {
  ...base,
  id: "tir_milestone",
  name: "A month to remember",
  description:
    "A calendar month with at least 70% of readings in your target range. Earned once, looking back.",
  icon: "milestone",
  repeatable: "once",
};
export const STEADIER_MONTH: AchievementDef = {
  ...base,
  id: "steadier_month",
  name: "A steadier month",
  description:
    "More of the month in your target range than the month before, with no more time low. At most once a quarter.",
  icon: "balance",
  // Evaluated per month, but keyed by quarter below, so a second month in a quarter adds nothing.
  repeatable: "per_period",
};
export const FEWER_LOWS: AchievementDef = {
  ...base,
  id: "fewer_lows",
  name: "Fewer lows",
  description:
    "Less time below range than the month before, while time in range held. At most once a quarter.",
  icon: "pulse",
  repeatable: "per_period",
};

export type HealthSources = {
  readings(ctx: RuleContext): Reading[];
  /** Range in force over time. Not stored by the app today, so the default is none ("not_available"). */
  rangeHistory?(ctx: RuleContext): RangeSpan[] | undefined;
  severeLows?(ctx: RuleContext): number[] | undefined;
};

const defaultSources: HealthSources = { readings: (c) => c.state.imported };

const monthStart = (y: number, m: number) => new Date(y, m, 1).getTime();

/** Most recent calendar month that has ended and settled (48 h) as of `now`, and the month before it. */
export function evaluatedMonths(now: number) {
  const d = new Date(now);
  let y = d.getFullYear();
  let m = d.getMonth() - 1;
  while (monthStart(y, m + 1) + SETTLE_MS > now) m--;
  const at = (mm: number) => {
    const t = new Date(y, mm, 1);
    return {
      start: t.getTime(),
      end: monthStart(t.getFullYear(), t.getMonth() + 1),
    };
  };
  return { target: at(m), baseline: at(m - 1) };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function inputFor(
  ctx: RuleContext,
  src: HealthSources,
  p: { start: number; end: number },
  role: "target" | "baseline",
): CheckInput {
  return {
    readings: src.readings(ctx),
    periodStart: p.start,
    periodEnd: p.end,
    now: ctx.now,
    range: ctx.state.range,
    rangeHistory: src.rangeHistory?.(ctx),
    profile: ctx.state.profile,
    privacy: ctx.state.privacy,
    flags: ctx.flags,
    // Prototype mode: the flag is the only switch, and demo medals are labelled and never public.
    prototypeDemo: ctx.flags.healthAchievements,
    severeLows: src.severeLows?.(ctx),
    role,
  };
}

function snapshot(t: PeriodStats, prev?: PeriodStats) {
  const snap: Record<string, string | number> = {
    tirPct: r1(t.tir),
    below70Pct: r1(t.below70),
    below54Pct: r1(t.below54),
    source: t.source,
    rangeLow: t.rangeLow,
    rangeHigh: t.rangeHigh,
    coveragePct: r1(t.coverage),
    rangeHistory: t.rangeHistory,
    severeLow: t.severeLow,
  };
  if (prev) {
    snap.prevTirPct = r1(prev.tir);
    snap.prevBelow70Pct = r1(prev.below70);
    snap.prevBelow54Pct = r1(prev.below54);
  }
  return snap;
}

type Judge = (t: PeriodStats, prev: PeriodStats) => boolean;

function build(
  def: AchievementDef,
  src: HealthSources,
  needsBaseline: boolean,
  judge: Judge,
  keyPeriod: "quarter" | "none",
): Rule {
  return {
    def,
    evaluate(ctx): RuleResult[] {
      const { target, baseline } = evaluatedMonths(ctx.now);
      const t = checkPeriod(inputFor(ctx, src, target, "target"));
      if (!t.eligible || !t.stats) return [];
      let prev: PeriodStats | undefined;
      if (needsBaseline) {
        const b = checkPeriod(inputFor(ctx, src, baseline, "baseline"));
        // The baseline must pass coverage, definition and source checks and use the same source.
        if (!b.eligible || !b.stats || b.stats.source !== t.stats.source)
          return [];
        prev = b.stats;
      }
      if (!judge(t.stats, prev as PeriodStats)) return [];
      return [
        {
          periodKey: periodKey(keyPeriod, target.start),
          snapshot: snapshot(t.stats, prev),
        },
      ];
    },
  };
}

export function healthRules(src: HealthSources = defaultSources): Rule[] {
  return [
    build(TIR_MILESTONE, src, false, (t) => t.tir >= 70, "none"),
    build(
      STEADIER_MONTH,
      src,
      true,
      (t, p) =>
        t.tir - p.tir >= 5 && t.below70 <= p.below70 && t.below54 <= p.below54,
      "quarter",
    ),
    build(
      FEWER_LOWS,
      src,
      true,
      (t, p) =>
        p.below70 >= 4 &&
        p.below70 - t.below70 >= 1 &&
        t.below54 <= p.below54 &&
        t.tir >= p.tir - 5,
      "quarter",
    ),
  ];
}

export const HEALTH_RULES: Rule[] = healthRules();
