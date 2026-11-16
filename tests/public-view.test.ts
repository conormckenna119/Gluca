import { test } from "node:test";
import assert from "node:assert/strict";
import { publicView } from "../src/domain/public-view";
import {
  defaultPrivacy,
  defaultProfile,
  type Profile,
} from "../src/domain/profile";
import type { Award } from "../src/domain/achievements";

const today = { year: 2026, month: 11, day: 16 };
const profile: Profile = {
  ...defaultProfile(),
  displayName: "Sam",
  onboarded: true,
  role: "living",
  diabetesType: "type1",
  diagnosis: { year: 2010, month: 3, day: 4 },
  birthday: { year: 1990, month: 11, day: 16 },
  ageConfirmed: true,
  monitoring: "cgm",
  cgm: { brand: "dexcom", model: "G7" },
  delivery: { method: "tandem", model: "Mobi" },
  emblem: "supporter",
  interests: ["running"],
};
const award = (id: string, o: Partial<Award> = {}): Award => ({
  id,
  userId: "me",
  achievementId: id,
  awardedAt: 1,
  periodKey: "",
  ruleVersion: 1,
  visibility: "public",
  pinned: true,
  ...o,
});
const extras = (o: Partial<Parameters<typeof publicView>[2]> = {}) => ({
  clubs: ["A", "B"],
  clubVisibility: { A: true, B: false },
  awards: [] as Award[],
  today,
  ...o,
});
const on = (k: keyof ReturnType<typeof defaultPrivacy>) => ({
  ...defaultPrivacy(),
  [k]: true,
});

test("all switches off shows only the name", () => {
  const v = publicView(
    profile,
    defaultPrivacy(),
    extras({ awards: [award("x", { visibility: "private" })] }),
  );
  assert.deepEqual(v, { name: "Sam", pinnedAchievements: [] });
});

test("each switch reveals exactly its own field", () => {
  const keys = (p: object) =>
    Object.keys(p).filter((k) => k !== "name" && k !== "pinnedAchievements");
  assert.deepEqual(keys(publicView(profile, on("showShield"), extras())), [
    "shield",
  ]);
  assert.deepEqual(keys(publicView(profile, on("showEmblem"), extras())), [
    "emblem",
  ]);
  assert.deepEqual(
    keys(publicView(profile, on("showDiabetesType"), extras())),
    ["diabetesType"],
  );
  assert.deepEqual(keys(publicView(profile, on("showDelivery"), extras())), [
    "delivery",
  ]);
  assert.deepEqual(keys(publicView(profile, on("showCgm"), extras())), ["cgm"]);
  assert.deepEqual(keys(publicView(profile, on("showBirthday"), extras())), [
    "birthdayToday",
  ]);
  assert.deepEqual(keys(publicView(profile, on("showMemberships"), extras())), [
    "communities",
  ]);
  assert.deepEqual(
    keys(publicView(profile, on("showShieldNumber"), extras())),
    [],
  );
  assert.deepEqual(
    keys(publicView(profile, on("healthAchievements"), extras())),
    [],
  );
});

test("the number needs showShieldNumber, and the shield needs a diagnosis", () => {
  const p1 = { ...defaultPrivacy(), showShield: true };
  assert.equal(publicView(profile, p1, extras()).shield?.years, undefined);
  assert.equal(
    publicView(profile, { ...p1, showShieldNumber: true }, extras()).shield
      ?.years,
    16,
  );
  assert.equal(
    publicView({ ...profile, diagnosis: undefined }, p1, extras()).shield,
    undefined,
  );
  const approx = { ...profile, diagnosis: { year: 2010, approximate: true } };
  assert.equal(
    publicView(approx, { ...p1, showShieldNumber: true }, extras()).shield
      ?.certain,
    false,
  );
});

test("birthday shows only on the day, and never the date", () => {
  const p = on("showBirthday");
  assert.equal(
    publicView(profile, p, extras({ today: { ...today, day: 17 } }))
      .birthdayToday,
    undefined,
  );
  const v = publicView(profile, p, extras());
  assert.equal(v.birthdayToday, true);
  assert.equal(JSON.stringify(v).includes("1990"), false);
  const noDay = { ...profile, birthday: { year: 1990, month: 11 } };
  assert.equal(publicView(noDay, p, extras()).birthdayToday, undefined);
});

test("prefer_not values are never shown", () => {
  const pn: Profile = {
    ...profile,
    diabetesType: "prefer_not",
    cgm: { brand: "prefer_not" },
    delivery: { method: "prefer_not" },
  };
  const all = {
    ...defaultPrivacy(),
    showDiabetesType: true,
    showCgm: true,
    showDelivery: true,
  };
  assert.deepEqual(publicView(pn, all, extras()), {
    name: "Sam",
    pinnedAchievements: [],
  });
});

test("private clubs never appear and memberships need their switch", () => {
  assert.deepEqual(
    publicView(profile, on("showMemberships"), extras()).communities,
    ["A"],
  );
  const none = extras({ clubVisibility: { A: false } });
  assert.equal(
    publicView(profile, on("showMemberships"), none).communities,
    undefined,
  );
  assert.equal(
    publicView(profile, defaultPrivacy(), extras()).communities,
    undefined,
  );
});

test("only pinned, public, non-withdrawn awards appear", () => {
  const awards = [
    award("ok"),
    award("priv", { visibility: "private" }),
    award("gone", { withdrawn: { at: 1, reason: "x" } }),
    award("unpinned", { pinned: false }),
  ];
  assert.deepEqual(
    publicView(profile, defaultPrivacy(), extras({ awards }))
      .pinnedAchievements,
    ["ok"],
  );
});

test("never leaks diagnosis date, birthday, age or interests", () => {
  const all = Object.fromEntries(
    Object.keys(defaultPrivacy()).map((k) => [k, true]),
  ) as ReturnType<typeof defaultPrivacy>;
  const json = JSON.stringify(publicView(profile, all, extras()));
  for (const s of [
    "2010",
    "1990",
    "running",
    "diagnosis",
    'birthday"',
    "interests",
    "age",
  ]) {
    assert.equal(json.includes(s), false, s);
  }
});
