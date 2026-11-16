import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMMUNITIES,
  joinCommunity,
  leaveCommunity,
  setCommunityVisible,
  suggestedFor,
} from "../src/domain/communities";
import { defaultProfile, type Profile } from "../src/domain/profile";
import { emptyCounters } from "../src/domain/achievements";

const today = { year: 2026, month: 11, day: 16 };
const prof = (p: Partial<Profile>): Profile => ({ ...defaultProfile(), ...p });
const names = (p: Profile, joined: string[] = []) =>
  suggestedFor(p, today, joined).map((s) => s.community.name);
const slice = () => ({
  clubs: [] as string[],
  clubVisibility: {} as Record<string, boolean>,
  counters: emptyCounters(),
});

test("empty profile gets no suggestions", () =>
  assert.deepEqual(names(defaultProfile()), []));

test("device rules with plain reasons", () => {
  const s = suggestedFor(prof({ delivery: { method: "omnipod" } }), today, []);
  assert.equal(s[0].community.name, "Omnipod users");
  assert.equal(s[0].reason, "Because your profile says you use Omnipod");
  assert.deepEqual(names(prof({ delivery: { method: "tandem" } })), [
    "Tandem users",
  ]);
  assert.deepEqual(names(prof({ delivery: { method: "twiist" } })), [
    "twiist users",
  ]);
  assert.deepEqual(names(prof({ delivery: { method: "pens" } })), [
    "Multiple daily injection users",
  ]);
  assert.deepEqual(names(prof({ cgm: { brand: "dexcom", model: "G7" } })), [
    "Dexcom G7 users",
  ]);
  assert.deepEqual(names(prof({ cgm: { brand: "dexcom", model: "G6" } })), []);
});

test("diagnosis rules use completed years", () => {
  const t1 = { diabetesType: "type1" as const };
  assert.deepEqual(
    names(prof({ ...t1, diagnosis: { year: 2026, month: 3, day: 1 } })),
    ["Newly diagnosed T1Ds"],
  );
  assert.deepEqual(
    names(prof({ ...t1, diagnosis: { year: 2000, month: 1, day: 1 } })),
    ["Long-term T1Ds"],
  );
  assert.deepEqual(
    names(prof({ ...t1, diagnosis: { year: 2015, month: 1, day: 1 } })),
    [],
  );
  assert.deepEqual(
    names(
      prof({
        diabetesType: "type2",
        diagnosis: { year: 2000, month: 1, day: 1 },
      }),
    ),
    [],
  );
});

test("interest, supporter and caregiver rules", () => {
  assert.deepEqual(names(prof({ interests: ["Running"] })), [
    "Diabetic runners",
    "Type 1 Runners",
  ]);
  assert.deepEqual(names(prof({ role: "supporting" })), [
    "Diabetes supporters",
  ]);
  assert.deepEqual(names(prof({ emblem: "caregiver" })), [
    "Parents and caregivers",
  ]);
});

test("supporters never get device or diagnosis communities", () => {
  const p = prof({
    role: "supporting",
    diabetesType: "type1",
    diagnosis: { year: 2000 },
    delivery: { method: "tandem" },
    cgm: { brand: "dexcom", model: "G7" },
    interests: ["running"],
  });
  assert.deepEqual(names(p), ["Diabetes supporters"]);
});

test("joined clubs are skipped and there are at most four", () => {
  const p = prof({
    delivery: { method: "tandem" },
    cgm: { brand: "dexcom", model: "G7" },
    interests: ["running", "golf", "tech", "strength"],
  });
  assert.equal(names(p).length, 4);
  assert.ok(!names(p, ["Tandem users"]).includes("Tandem users"));
});

test("suggesting never changes state; catalogue keeps club names", () => {
  const s = slice();
  const before = JSON.stringify(s);
  suggestedFor(prof({ interests: ["running"] }), today, s.clubs);
  assert.equal(JSON.stringify(s), before);
  for (const n of [
    "Type 1 Runners",
    "Diabetic Golfers",
    "Newly Diagnosed Community",
    "Diabetes Tech Enthusiasts",
    "T1D Strength Training",
  ])
    assert.ok(COMMUNITIES.some((c) => c.name === n));
});

test("join is private, counts once, leave clears visibility", () => {
  let s = joinCommunity(slice(), "Tandem users");
  assert.deepEqual(s.clubs, ["Tandem users"]);
  assert.equal(s.clubVisibility["Tandem users"], false);
  assert.equal(s.counters.communitiesJoined, 1);
  assert.equal(joinCommunity(s, "Tandem users").counters.communitiesJoined, 1);
  s = setCommunityVisible(s, "Tandem users", true);
  assert.equal(s.clubVisibility["Tandem users"], true);
  assert.equal(
    setCommunityVisible(s, "Other", true).clubVisibility["Other"],
    undefined,
  );
  s = leaveCommunity(s, "Tandem users");
  assert.deepEqual(s.clubs, []);
  assert.equal("Tandem users" in s.clubVisibility, false);
  assert.equal(s.counters.communitiesJoined, 1);
});

test("newly diagnosed is not suggested from a year-only or uncertain date", () => {
  const base = { displayName: "x", onboarded: true, interests: [], role: "living" as const, diabetesType: "type1" as const };
  const today = { year: 2026, month: 11, day: 16 };
  const names = (d: { year: number; month?: number; approximate?: boolean }) =>
    suggestedFor({ ...base, diagnosis: d }, today, []).map((s) => s.community.name);
  assert.ok(names({ year: 2026, month: 6 }).includes("Newly diagnosed T1Ds"));
  assert.equal(names({ year: 2025 }).includes("Newly diagnosed T1Ds"), false);
  assert.equal(names({ year: 2026, month: 6, approximate: true }).includes("Newly diagnosed T1Ds"), false);
});
