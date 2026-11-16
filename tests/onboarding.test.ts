import { isValidBirthday, sanitizeProfile } from "../src/domain/profile";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  birthdayFrom,
  completeOnboarding,
  formatBirthday,
  formatPartialDate,
  nextSteps,
  pruneDraft,
  summaryLines,
} from "../src/domain/onboarding";
import { defaultProfile, isValidPartialDate } from "../src/domain/profile";

const MEDICAL = [
  "diabetesType",
  "diagnosis",
  "monitoring",
  "cgm",
  "delivery",
  "deliveryModel",
  "units",
  "healthAchievements",
];

test("no role asks only the role, birthday and interests", () => {
  assert.deepEqual(nextSteps({}), ["role", "birthday", "interests"]);
});

test("living with diabetes: the full conditional flow", () => {
  assert.deepEqual(nextSteps({ role: "living" }), [
    "role",
    "diabetesType",
    "diagnosis",
    "monitoring",
    "delivery",
    "birthday",
    "units",
    "interests",
    "healthAchievements",
  ]);
  assert.ok(nextSteps({ role: "living", monitoring: "cgm" }).includes("cgm"));
  assert.ok(nextSteps({ role: "living", monitoring: "both" }).includes("cgm"));
  assert.ok(
    !nextSteps({ role: "living", monitoring: "meter" }).includes("cgm"),
  );
  assert.ok(
    nextSteps({ role: "living", delivery: { method: "omnipod" } }).includes(
      "deliveryModel",
    ),
  );
  assert.ok(
    !nextSteps({ role: "living", delivery: { method: "pens" } }).includes(
      "deliveryModel",
    ),
  );
  const order = nextSteps({
    role: "living",
    monitoring: "cgm",
    delivery: { method: "tandem" },
  });
  assert.deepEqual(order.slice(3, 7), [
    "monitoring",
    "cgm",
    "delivery",
    "deliveryModel",
  ]);
});

test("supporters and awareness are never asked anything medical", () => {
  for (const role of ["supporting", "awareness"] as const) {
    const steps = nextSteps({
      role,
      monitoring: "cgm",
      delivery: { method: "tandem" },
    });
    assert.deepEqual(steps, ["role", "emblem", "birthday", "interests"]);
    for (const m of MEDICAL) assert.ok(!steps.includes(m as never), m);
  }
});

test("changing role drops answers that no longer apply", () => {
  const d = pruneDraft({
    profile: {
      role: "supporting",
      diabetesType: "type1",
      diagnosis: { year: 2010 },
      monitoring: "cgm",
      cgm: { brand: "dexcom" },
      delivery: { method: "tandem" },
      emblem: "caregiver",
    },
    unit: "mmol/L",
    healthAchievements: true,
  });
  assert.deepEqual(d, { profile: { role: "supporting", emblem: "caregiver" } });
  const living = pruneDraft({
    profile: {
      role: "living",
      emblem: "advocate",
      monitoring: "meter",
      cgm: { brand: "libre" },
      delivery: { method: "pens", model: "x" },
    },
  });
  assert.deepEqual(living.profile, {
    role: "living",
    monitoring: "meter",
    delivery: { method: "pens" },
  });
});

test("skipping everything gives a valid onboarded profile with nothing shared", () => {
  const r = completeOnboarding({ profile: {} }, defaultProfile());
  assert.equal(r.profile.onboarded, true);
  assert.equal(r.profile.displayName, "You");
  assert.deepEqual(r.profile.interests, []);
  assert.equal(r.profile.role, undefined);
  assert.equal(r.healthAchievements, false);
  assert.equal(r.unit, undefined);
});

test("a full living answer set is kept and sanitized", () => {
  const r = completeOnboarding(
    {
      profile: {
        displayName: "  Sam  ",
        role: "living",
        diabetesType: "type1",
        diagnosis: { year: 2010, month: 3, approximate: true },
        monitoring: "cgm",
        cgm: { brand: "dexcom", model: "G7" },
        delivery: { method: "tandem", model: "Mobi" },
        birthday: birthdayFrom(2, 29),
        ageConfirmed: true,
        interests: ["Running"],
      },
      unit: "mmol/L",
      healthAchievements: true,
    },
    defaultProfile(),
  );
  assert.equal(r.profile.displayName, "Sam");
  assert.deepEqual(r.profile.diagnosis, {
    year: 2010,
    month: 3,
    approximate: true,
  });
  assert.deepEqual(r.profile.cgm, { brand: "dexcom", model: "G7" });
  assert.deepEqual(r.profile.birthday?.month, 2);
  assert.equal(r.unit, "mmol/L");
  assert.equal(r.healthAchievements, true);
});

test("invalid dates are dropped, never guessed", () => {
  const r = completeOnboarding(
    { profile: { role: "living", diagnosis: { year: 2010, day: 5 } } },
    defaultProfile(),
  );
  assert.equal(r.profile.diagnosis, undefined);
});

test("a birthday has no year, allows 29 February and rejects impossible days", () => {
  assert.deepEqual(birthdayFrom(2, 29), { month: 2, day: 29 });
  assert.ok(isValidBirthday(birthdayFrom(2, 29)));
  assert.equal(isValidBirthday(birthdayFrom(2, 30)), false);
  assert.equal(isValidBirthday({ month: 13, day: 1 }), false);
  // A year in saved data is dropped, so no age can be worked out.
  assert.deepEqual(sanitizeProfile({ birthday: { year: 1990, month: 11, day: 16 } }).birthday, { month: 11, day: 16 });
  assert.equal(formatBirthday(birthdayFrom(11, 16)), "16 November");
});

test("partial dates are formatted without inventing parts", () => {
  assert.equal(formatPartialDate({ year: 2010 }), "2010");
  assert.equal(formatPartialDate({ year: 2010, month: 3 }), "March 2010");
  assert.equal(
    formatPartialDate({ year: 2010, month: 3, day: 4 }),
    "4 March 2010",
  );
  assert.equal(
    formatPartialDate({ year: 2010, approximate: true }),
    "around 2010",
  );
});

test("summary lists only answers given and respects the role", () => {
  assert.deepEqual(summaryLines({ profile: {} }), []);
  const lines = summaryLines({
    profile: { role: "supporting", emblem: "caregiver", diabetesType: "type1" },
    unit: "mg/dL",
  });
  assert.deepEqual(
    lines.map((l) => l.label),
    ["Connection", "Emblem"],
  );
});
