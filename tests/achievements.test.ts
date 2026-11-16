import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState } from "../src/state";
import { DEFAULT_FLAGS, type FlagState } from "../src/flags";
import {
  MAX_PINNED,
  awardId,
  type AchievementDef,
} from "../src/domain/achievements";
import { defaultPrivacy } from "../src/domain/profile";
import type { State } from "../src/types";
import { periodKey, isoWeek } from "../src/achievements/period";
import {
  availableDefs,
  evaluateAwards,
  pinAward,
  unpinAward,
  withdrawAward,
  setAwardVisibility,
  visibleAwards,
  publicAwards,
  publicMedal,
  type Rule,
} from "../src/achievements/engine";

const flags = (o: Partial<FlagState> = {}): FlagState => ({
  ...DEFAULT_FLAGS,
  achievements: true,
  ...o,
});
const def = (id: string, o: Partial<AchievementDef> = {}): AchievementDef => ({
  id,
  name: id,
  description: "d",
  category: "life",
  icon: "post",
  requiredData: [],
  period: "none",
  defaultVisibility: "private",
  repeatable: "once",
  ruleVersion: 2,
  safetyReview: "not_required",
  flag: "achievements",
  needsHealthOptIn: false,
  ...o,
});
const rule = (
  d: AchievementDef,
  keys: string[] | (() => string[]),
  snap?: Record<string, number>,
): Rule => ({
  def: d,
  evaluate: () =>
    (typeof keys === "function" ? keys() : keys).map((periodKey) => ({
      periodKey,
      snapshot: snap,
    })),
});
const ctx = (state: State, now = 1000, f = flags()) => ({
  state,
  now,
  flags: f,
});

test("period keys", () => {
  const d = new Date(2026, 10, 16, 12);
  assert.equal(periodKey("none", d), "");
  assert.equal(periodKey("year", d), "2026");
  assert.equal(periodKey("month", d), "2026-11");
  assert.equal(periodKey("quarter", d), "2026-Q4");
  assert.equal(periodKey("week", d), "2026-W47");
  assert.equal(periodKey("quarter", new Date(2026, 2, 31)), "2026-Q1");
  assert.equal(periodKey("quarter", new Date(2026, 3, 1)), "2026-Q2");
  assert.equal(periodKey("month", new Date(2026, 0, 1).getTime()), "2026-01");
});

test("ISO weeks at year boundaries", () => {
  assert.deepEqual(isoWeek(2021, 1, 3), { year: 2020, week: 53 }); // Sunday still in 2020's last week
  assert.deepEqual(isoWeek(2021, 1, 4), { year: 2021, week: 1 });
  assert.deepEqual(isoWeek(2024, 12, 30), { year: 2025, week: 1 }); // Monday belongs to 2025
  assert.deepEqual(isoWeek(2026, 1, 1), { year: 2026, week: 1 });
  assert.deepEqual(isoWeek(2026, 12, 31), { year: 2026, week: 53 });
  assert.deepEqual(isoWeek(2027, 1, 3), { year: 2026, week: 53 });
  assert.equal(periodKey("week", new Date(2024, 11, 31)), "2025-W01");
  assert.equal(periodKey("week", new Date(2026, 5, 1)), "2026-W23");
});

test("evaluation is idempotent and new awards use the def's defaults", () => {
  const rules = [
    rule(def("a", { defaultVisibility: "public" }), [""], { n: 3 }),
  ];
  const s = emptyState();
  const first = evaluateAwards(rules, ctx(s));
  assert.equal(first.added.length, 1);
  const a = first.added[0];
  assert.deepEqual(
    [a.id, a.visibility, a.pinned, a.ruleVersion, a.awardedAt],
    [awardId("me", "a", ""), "public", false, 2, 1000],
  );
  assert.deepEqual(a.snapshot, { n: 3 });
  const second = evaluateAwards(
    rules,
    ctx({ ...s, awards: first.awards }, 2000),
  );
  assert.equal(second.added.length, 0);
  assert.deepEqual(second.awards, first.awards);
});

test("per-period, yearly and once-only repeats", () => {
  const weekly = def("w", { repeatable: "per_period", period: "week" });
  let keys = ["2026-W46"];
  const rules = [
    rule(weekly, () => keys),
    rule(def("y", { repeatable: "yearly", period: "year" }), ["2026"]),
    rule(def("o"), ["2026"]),
  ];
  const r1 = evaluateAwards(rules, ctx(emptyState()));
  assert.deepEqual(
    r1.awards.map((a) => a.id),
    ["me:w:2026-W46", "me:y:2026", "me:o:"],
  );
  keys = ["2026-W46", "2026-W47"];
  const r2 = evaluateAwards(rules, ctx({ ...emptyState(), awards: r1.awards }));
  assert.deepEqual(
    r2.added.map((a) => a.id),
    ["me:w:2026-W47"],
  );
  const rules2 = [
    rule(def("y", { repeatable: "yearly", period: "year" }), ["2027"]),
  ];
  assert.deepEqual(
    evaluateAwards(
      rules2,
      ctx({ ...emptyState(), awards: r1.awards }),
    ).added.map((a) => a.id),
    ["me:y:2027"],
  );
});

test("a withdrawn award is not re-awarded", () => {
  const rules = [rule(def("a"), [""])];
  const { awards } = evaluateAwards(rules, ctx(emptyState()));
  const w = withdrawAward(awards, "me:a:", "wrong data", 5);
  const again = evaluateAwards(rules, ctx({ ...emptyState(), awards: w }));
  assert.equal(again.added.length, 0);
  assert.equal(again.awards[0].withdrawn?.reason, "wrong data");
});

test("an award is never removed or changed when the rule stops matching", () => {
  let on = true;
  const rules = [rule(def("a"), () => (on ? [""] : []))];
  const { awards } = evaluateAwards(rules, ctx(emptyState()));
  on = false;
  const later = evaluateAwards(rules, ctx({ ...emptyState(), awards }, 9999));
  assert.deepEqual(later.awards, awards);
  assert.equal(later.added.length, 0);
});

const five = () => {
  const rules = ["a", "b", "c", "d"].map((id) => rule(def(id), [""]));
  return evaluateAwards(rules, ctx(emptyState())).awards;
};

test("at most three pinned; the fourth is refused with a reason", () => {
  let awards = five();
  for (const id of ["a", "b", "c"])
    awards = pinAward(awards, `me:${id}:`).awards;
  assert.equal(awards.filter((a) => a.pinned).length, MAX_PINNED);
  const r = pinAward(awards, "me:d:");
  assert.equal(r.awards, awards);
  assert.ok(r.reason);
  const freed = unpinAward(awards, "me:a:");
  assert.equal(
    pinAward(freed, "me:d:").awards.find((a) => a.id === "me:d:")?.pinned,
    true,
  );
});

test("withdrawing unpins, and a withdrawn award cannot be pinned", () => {
  let awards = pinAward(five(), "me:a:").awards;
  awards = withdrawAward(awards, "me:a:", "x", 1);
  assert.equal(awards[0].pinned, false);
  assert.ok(pinAward(awards, "me:a:").reason);
  assert.equal(visibleAwards(awards).length, 3);
});

test("public view never contains the snapshot or exact time", () => {
  const d = def("a", { defaultVisibility: "public" });
  const { awards } = evaluateAwards(
    [rule(d, [""], { secret: 42 })],
    ctx(emptyState(), new Date(2026, 5, 1).getTime()),
  );
  assert.equal(publicAwards(awards).length, 1);
  const m = publicMedal(awards[0], d);
  assert.deepEqual(m, {
    name: "a",
    icon: "post",
    category: "life",
    year: 2026,
  });
  assert.equal(JSON.stringify(m).includes("secret"), false);
  const hidden = setAwardVisibility(awards, awards[0].id, "private");
  assert.equal(publicAwards(hidden).length, 0);
});

test("flag off or disabled hides the def", () => {
  const r = [rule(def("a"), [""])];
  assert.equal(availableDefs(r, flags(), defaultPrivacy()).length, 1);
  assert.equal(
    availableDefs(r, flags({ achievements: false }), defaultPrivacy()).length,
    0,
  );
  assert.equal(
    availableDefs(
      [rule(def("a", { disabled: true }), [""])],
      flags(),
      defaultPrivacy(),
    ).length,
    0,
  );
  assert.equal(
    evaluateAwards(r, ctx(emptyState(), 1, flags({ achievements: false })))
      .awards.length,
    0,
  );
});

test("health opt-in gating", () => {
  const h = [
    rule(
      def("h", {
        category: "health",
        needsHealthOptIn: true,
        safetyReview: "approved",
      }),
      [""],
    ),
  ];
  const pending = [
    rule(
      def("h", {
        category: "health",
        needsHealthOptIn: true,
        safetyReview: "pending",
      }),
      [""],
    ),
  ];
  const on = { ...defaultPrivacy(), healthAchievements: true };
  assert.equal(availableDefs(h, flags(), defaultPrivacy()).length, 0);
  assert.equal(availableDefs(h, flags(), on).length, 1);
  assert.equal(availableDefs(pending, flags(), on).length, 0);
  // Prototype flag alone is never enough: the person's own opt-in is always required.
  assert.equal(
    availableDefs(
      pending,
      flags({ healthAchievements: true }),
      defaultPrivacy(),
    ).length,
    0,
  );
  assert.equal(
    availableDefs(pending, flags({ healthAchievements: true }), on).length,
    1,
  );
});
