import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState } from "../src/state";
import { DEFAULT_FLAGS } from "../src/flags";
import type { Reading, State } from "../src/types";
import { availableDefs, evaluateAwards } from "../src/achievements/engine";
import {
  checkPeriod,
  type CheckInput,
  type RangeSpan,
} from "../src/achievements/eligibility";
import {
  HEALTH_RULES,
  evaluatedMonths,
  healthRules,
} from "../src/achievements/health";

// ---- synthetic data: 5-minute samples, local calendar days ----
type Spec = {
  below54?: number; // % of each day
  below70?: number; // % of each day, includes below54
  above?: number; // % of each day
  gap?: number; // % of each day missing, at the end of the day
  badDays?: number; // first N days use `badGap` instead of `gap`
  badGap?: number;
  source?: Reading["source"];
};
const DAY = 288;
function month(y: number, m: number, s: Spec = {}): Reading[] {
  const out: Reading[] = [];
  const days = new Date(y, m + 1, 0).getDate();
  const n54 = Math.round((DAY * (s.below54 ?? 0)) / 100);
  const n70 = Math.round((DAY * (s.below70 ?? 2)) / 100);
  const nAbove = Math.round((DAY * (s.above ?? 10)) / 100);
  for (let d = 1; d <= days; d++) {
    const gap = d <= (s.badDays ?? 0) ? (s.badGap ?? 0) : (s.gap ?? 0);
    const keep = DAY - Math.round((DAY * gap) / 100);
    for (let i = 0; i < keep; i++) {
      const mgdl = i < n54 ? 50 : i < n70 ? 62 : i < n70 + nAbove ? 250 : 120;
      out.push({
        timestamp: new Date(y, m, d, 0, i * 5).getTime(),
        mgdl,
        source: s.source ?? "csv",
      });
    }
  }
  return out;
}
const SEP = [2026, 8] as const;
const OCT = [2026, 9] as const;
const NOV = [2026, 10] as const;
const at = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime();
const NOW = at(2026, 10, 10); // 10 Nov 2026: October is complete and settled
const octStart = new Date(2026, 9, 1).getTime();
const octEnd = new Date(2026, 10, 1).getTime();

const input = (over: Partial<CheckInput> = {}): CheckInput => ({
  readings: month(...OCT),
  periodStart: octStart,
  periodEnd: octEnd,
  now: NOW,
  range: { low: 70, high: 180 },
  profile: { ageConfirmed: true, diabetesType: "type1" },
  privacy: { healthAchievements: true },
  flags: { healthAchievements: true },
  prototypeDemo: false,
  ...over,
});
const reasons = (over: Partial<CheckInput> = {}) => checkPeriod(input(over));

// ---- the gate: each line failing on its own gives exactly its reason ----
test("a clean month passes the gate", () => {
  const r = reasons();
  assert.deepEqual(r.reasons, []);
  assert.equal(r.eligible, true);
  assert.equal(r.stats?.source, "csv");
  assert.equal(r.stats?.rangeHistory, "not_available");
  assert.equal(r.stats?.severeLow, "not_available");
});

const single: [string, Partial<CheckInput>, string][] = [
  ["flag off", { flags: { healthAchievements: false } }, "not_opted_in"],
  ["opt-in off", { privacy: { healthAchievements: false } }, "not_opted_in"],
  [
    "adult not confirmed",
    { profile: { diabetesType: "type1" } },
    "not_adult_confirmed",
  ],
  [
    "gestational",
    { profile: { ageConfirmed: true, diabetesType: "gestational" } },
    "gestational",
  ],
  ["period running", { now: at(2026, 9, 20) }, "period_not_complete"],
  [
    "ended under 48 h ago",
    { now: new Date(2026, 10, 2, 0, 0).getTime() },
    "period_not_settled",
  ],
  ["coverage low", { readings: month(...OCT, { gap: 12 }) }, "coverage_low"],
  [
    "too few good days",
    { readings: month(...OCT, { badDays: 6, badGap: 35 }) },
    "days_low_coverage",
  ],
  [
    "range changed",
    {
      rangeHistory: [{ from: 0, low: 80, high: 180 }] as RangeSpan[],
    },
    "range_changed",
  ],
  [
    "mixed sources",
    {
      readings: [
        ...month(...OCT).slice(0, 4000),
        ...month(...OCT, { source: "dexcom" }).slice(4000),
      ],
    },
    "mixed_sources",
  ],
  [
    "demo data outside prototype",
    { readings: month(...OCT, { source: "mock" }) },
    "demo_data",
  ],
  [
    "below 70 high",
    { readings: month(...OCT, { below70: 5, below54: 0.5 }) },
    "below_70_high",
  ],
  [
    "below 54 high",
    { readings: month(...OCT, { below70: 3, below54: 1.5 }) },
    "below_54_high",
  ],
  [
    "severe low recorded",
    { severeLows: [at(2026, 9, 15)] },
    "severe_low_recorded",
  ],
];
for (const [name, over, code] of single) {
  test(`gate: ${name} gives only ${code}`, () => {
    const r = reasons(over);
    assert.deepEqual(r.reasons, [code]);
    assert.equal(r.eligible, false);
  });
}

test("gate: demo data is allowed in prototype mode and labelled demo", () => {
  const r = reasons({
    readings: month(...OCT, { source: "mock" }),
    prototypeDemo: true,
  });
  assert.equal(r.eligible, true);
  assert.equal(r.stats?.source, "demo");
});

test("gate: missing data is never counted as in range", () => {
  // 60% coverage, everything observed is in range.
  const r = reasons({
    readings: month(...OCT, { below70: 0, above: 0, gap: 40 }),
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes("coverage_low"));
  assert.ok(Math.abs((r.stats?.coverage ?? 0) - 60) < 1);
});

test("gate: a severe low outside the period is ignored; supplied history is recorded", () => {
  const r = reasons({ severeLows: [at(2026, 8, 15)], rangeHistory: [] });
  assert.equal(r.eligible, true);
  assert.equal(r.stats?.severeLow, "none");
  assert.equal(r.stats?.rangeHistory, "available");
});

test("gate: a baseline month may have lows but still needs coverage", () => {
  const sep = new Date(2026, 8, 1).getTime();
  const base = {
    periodStart: sep,
    periodEnd: octStart,
    role: "baseline" as const,
  };
  assert.deepEqual(
    reasons({ ...base, readings: month(...SEP, { below70: 6 }) }).reasons,
    [],
  );
  assert.deepEqual(
    reasons({ ...base, readings: month(...SEP, { gap: 20 }) }).reasons,
    ["coverage_low"],
  );
});

// ---- the rules ----
const flagsOn = { ...DEFAULT_FLAGS, healthAchievements: true };
const stateWith = (
  readings: Reading[],
  awards: State["awards"] = [],
): State => {
  const s = emptyState();
  return {
    ...s,
    imported: readings,
    awards,
    profile: { ...s.profile, ageConfirmed: true, diabetesType: "type1" },
    privacy: { ...s.privacy, healthAchievements: true },
  };
};
const run = (s: State, now = NOW, flags = flagsOn, rules = HEALTH_RULES) =>
  evaluateAwards(rules, { state: s, now, flags });
const ids = (s: State, now = NOW) =>
  run(s, now)
    .added.map((a) => a.achievementId)
    .sort();

const GOOD: Spec = { below70: 2, above: 10 }; // 88% in range
const sep = (s: Spec) => month(...SEP, s);
const oct = (s: Spec) => month(...OCT, s);

test("evaluatedMonths picks the latest settled month and the one before", () => {
  const a = evaluatedMonths(NOW);
  assert.equal(a.target.start, octStart);
  assert.equal(a.baseline.start, new Date(2026, 8, 1).getTime());
  // 1 Nov 12:00: October ended under 48 h ago, so September is the target.
  const b = evaluatedMonths(at(2026, 10, 1));
  assert.equal(b.target.start, new Date(2026, 8, 1).getTime());
});

test("tir_milestone: awarded once for 70% or more, private, with a limited snapshot", () => {
  const r = run(stateWith(oct(GOOD)));
  assert.deepEqual(
    r.added.map((a) => a.achievementId),
    ["tir_milestone"],
  );
  const a = r.added[0];
  assert.equal(a.visibility, "private");
  assert.equal(a.periodKey, "");
  assert.deepEqual(Object.keys(a.snapshot ?? {}).sort(), [
    "below54Pct",
    "below70Pct",
    "coveragePct",
    "rangeHigh",
    "rangeHistory",
    "rangeLow",
    "severeLow",
    "source",
    "tirPct",
  ]);
  assert.equal(a.snapshot?.source, "csv");
  assert.equal(a.snapshot?.rangeHistory, "not_available");
  assert.equal(a.snapshot?.severeLow, "not_available");
});

test("tir_milestone: under 70% awards nothing", () => {
  assert.deepEqual(ids(stateWith(oct({ below70: 2, above: 40 }))), []);
});

test("tir_milestone awards once only, even for a later qualifying month", () => {
  const s = stateWith([...oct(GOOD), ...month(...NOV, GOOD)]);
  const first = run(s);
  assert.equal(first.added.length, 1);
  const dec = at(2026, 11, 10);
  const next = run({ ...s, awards: first.awards }, dec);
  assert.deepEqual(next.added, []);
});

test("steadier_month: rises by 5 points with no more time low", () => {
  const s = stateWith([
    ...sep({ below70: 2, above: 28 }),
    ...oct({ below70: 2, above: 20 }),
  ]);
  const r = run(s);
  const a = r.added.find((x) => x.achievementId === "steadier_month");
  assert.ok(a);
  assert.equal(a.periodKey, "2026-Q4");
  assert.equal(a.visibility, "private");
  assert.equal(a.snapshot?.prevTirPct !== undefined, true);
});

test("steadier_month: rejects a rise under 5 points, or when lows rose", () => {
  const small = stateWith([
    ...sep({ below70: 2, above: 20 }),
    ...oct({ below70: 2, above: 17 }),
  ]);
  assert.ok(!ids(small).includes("steadier_month"));
  const lows = stateWith([
    ...sep({ below70: 1, above: 30 }),
    ...oct({ below70: 3, above: 10 }),
  ]);
  assert.ok(!ids(lows).includes("steadier_month"));
  const lows54 = stateWith([
    ...sep({ below70: 3, below54: 0, above: 30 }),
    ...oct({ below70: 3, below54: 0.7, above: 10 }),
  ]);
  assert.ok(!ids(lows54).includes("steadier_month"));
});

test("fewer_lows: lower by a point, time in range holding", () => {
  const s = stateWith([
    ...sep({ below70: 6, above: 14 }),
    ...oct({ below70: 3, above: 17 }),
  ]);
  const a = run(s).added.find((x) => x.achievementId === "fewer_lows");
  assert.ok(a);
  assert.equal(a.periodKey, "2026-Q4");
});

test("fewer_lows: rejects when time in range fell by more than 5 points", () => {
  const s = stateWith([
    ...sep({ below70: 6, above: 10 }), // 84
    ...oct({ below70: 3, above: 20 }), // 77
  ]);
  assert.ok(!ids(s).includes("fewer_lows"));
});

test("fewer_lows: rejects when the baseline had under 4% below 70", () => {
  const s = stateWith([
    ...sep({ below70: 3, above: 14 }),
    ...oct({ below70: 1, above: 14 }),
  ]);
  assert.ok(!ids(s).includes("fewer_lows"));
});

test("comparison rules reject a baseline that fails coverage; tir_milestone still stands", () => {
  const s = stateWith([
    ...sep({ below70: 6, above: 28, gap: 20 }),
    ...oct({ below70: 3, above: 5 }),
  ]);
  assert.deepEqual(ids(s), ["tir_milestone"]);
});

test("comparison rules reject a different range in the history", () => {
  const readings = [
    ...sep({ below70: 6, above: 28 }),
    ...oct({ below70: 3, above: 5 }),
  ];
  const rules = healthRules({
    readings: (c) => c.state.imported,
    rangeHistory: () => [
      { from: 0, low: 80, high: 180 },
      { from: octStart, low: 70, high: 180 },
    ],
  });
  // September ran under 80-180: the baseline is not comparable. October (70-180) is fine.
  const r = run(stateWith(readings), NOW, flagsOn, rules);
  assert.deepEqual(
    r.added.map((a) => a.achievementId),
    ["tir_milestone"],
  );
  assert.equal(r.added[0].snapshot?.rangeHistory, "available");
  // A range change inside October rejects everything.
  const inOct = healthRules({
    readings: (c) => c.state.imported,
    rangeHistory: () => [
      { from: 0, low: 70, high: 180 },
      { from: at(2026, 9, 15), low: 80, high: 180 },
    ],
  });
  assert.deepEqual(run(stateWith(readings), NOW, flagsOn, inOct).added, []);
});

test("mixed sources reject, within a month and across the two months", () => {
  const within = stateWith([
    ...oct(GOOD).slice(0, 4000),
    ...month(...OCT, { ...GOOD, source: "dexcom" }).slice(4000),
  ]);
  assert.deepEqual(ids(within), []);
  const across = stateWith([
    ...sep({ below70: 6, above: 28, source: "dexcom" }),
    ...oct({ below70: 3, above: 5 }),
  ]);
  assert.deepEqual(ids(across), ["tir_milestone"]);
});

test("demo data fires only in prototype mode and is labelled demo", () => {
  const s = stateWith(month(...OCT, { ...GOOD, source: "mock" }));
  const r = run(s);
  assert.equal(r.added[0].snapshot?.source, "demo");
  assert.equal(r.added[0].visibility, "private");
  assert.equal(
    checkPeriod(input({ readings: s.imported, prototypeDemo: false }))
      .reasons[0],
    "demo_data",
  );
  assert.deepEqual(run(s, NOW, DEFAULT_FLAGS).added, []);
});

test("flag off makes the defs unavailable; opt-in off or a missing adult confirmation awards nothing", () => {
  const s = stateWith(oct(GOOD));
  assert.deepEqual(availableDefs(HEALTH_RULES, DEFAULT_FLAGS, s.privacy), []);
  assert.equal(availableDefs(HEALTH_RULES, flagsOn, s.privacy).length, 3);
  const noOptIn = {
    ...s,
    privacy: { ...s.privacy, healthAchievements: false },
  };
  assert.deepEqual(availableDefs(HEALTH_RULES, flagsOn, noOptIn.privacy), []);
  assert.deepEqual(run(noOptIn).added, []);
  const noAdult = { ...s, profile: { ...s.profile, ageConfirmed: false } };
  assert.deepEqual(run(noAdult).added, []);
});

test("quarterly cap: a second qualifying month in the same quarter adds nothing", () => {
  const readings = [
    ...sep({ below70: 2, above: 28 }),
    ...oct({ below70: 2, above: 20 }),
    ...month(...NOV, { below70: 2, above: 8 }),
  ];
  const s = stateWith(readings);
  const first = run(s);
  assert.ok(first.added.some((a) => a.achievementId === "steadier_month"));
  const dec = at(2026, 11, 10);
  const next = run({ ...s, awards: first.awards }, dec);
  // November also qualifies (+10 against October) but is in the same quarter as October.
  assert.deepEqual(
    next.added.filter((a) => a.achievementId === "steadier_month"),
    [],
  );
  assert.equal(
    next.awards.filter((a) => a.achievementId === "steadier_month").length,
    1,
  );
});

test("a later, worse month never removes an award", () => {
  const s = stateWith([
    ...oct(GOOD),
    ...month(...NOV, { below70: 9, below54: 3, above: 50 }),
  ]);
  const first = run(s);
  const next = run({ ...s, awards: first.awards }, at(2026, 11, 10));
  assert.deepEqual(next.added, []);
  assert.deepEqual(next.awards, first.awards);
});

test("health defs carry the safety metadata and avoid banned wording", () => {
  const banned =
    /streak|leaderboard|rank|lowest|record|beat|best|perfect|fasting|dose|winner|score/i;
  for (const { def } of HEALTH_RULES) {
    assert.equal(def.category, "health");
    assert.equal(def.flag, "healthAchievements");
    assert.equal(def.needsHealthOptIn, true);
    assert.equal(def.safetyReview, "pending");
    assert.equal(def.defaultVisibility, "private");
    assert.equal(def.minCoveragePct, 90);
    assert.equal(def.period, "month");
    assert.doesNotMatch(`${def.name} ${def.description}`, banned);
  }
  assert.deepEqual(
    HEALTH_RULES.map((r) => r.def.repeatable),
    ["once", "per_period", "per_period"],
  );
});
