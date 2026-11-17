import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chooseConnection,
  connectionChoice,
  CONNECTIONS,
} from "../src/domain/profile-experience";
import {
  defaultProfile,
  defaultPrivacy,
  sanitizeProfile,
} from "../src/domain/profile";
import { publicView } from "../src/domain/public-view";
import {
  completedYears,
  shieldFor,
  nextAnniversary,
} from "../src/domain/shield";
const today = { year: 2026, month: 11, day: 16 },
  extras = { today, clubs: [], clubVisibility: {}, awards: [] };
test("all seven community identities work; supporters keep prior medical data private without deleting it", () => {
  for (const choice of Object.keys(
    CONNECTIONS,
  ) as (keyof typeof CONNECTIONS)[]) {
    const p = chooseConnection(
      {
        ...defaultProfile(),
        diagnosis: { year: 1999 },
        cgm: { brand: "dexcom", model: "G7" },
      },
      choice,
    );
    assert.equal(connectionChoice(p), choice);
    assert.deepEqual(p.diagnosis, { year: 1999 });
    const v = publicView(
      p,
      { ...defaultPrivacy(), showShield: true, showCgm: true },
      extras,
    );
    if (["supporter", "caregiver", "awareness", "private"].includes(choice)) {
      assert.equal(v.shield, undefined);
      assert.equal(v.cgm, undefined);
    }
  }
});
test("partial dates never gain unknown parts or exact anniversaries; leap diagnosis completes on March 1", () => {
  const p = sanitizeProfile({ diagnosis: { year: 2000 } });
  assert.deepEqual(p.diagnosis, { year: 2000 });
  assert.equal(shieldFor(p.diagnosis, today)!.certain, false);
  assert.equal(nextAnniversary(p.diagnosis, today), null);
  assert.equal(
    completedYears(
      { year: 2024, month: 2, day: 29 },
      { year: 2025, month: 2, day: 28 },
    )!.years,
    0,
  );
  assert.equal(
    completedYears(
      { year: 2024, month: 2, day: 29 },
      { year: 2025, month: 3, day: 1 },
    )!.years,
    1,
  );
  assert.equal(nextAnniversary({ year: 2000, month: 11 }, today), null);
});
test("public profile metadata is bounded and medical fields remain private by default", () => {
  const p = sanitizeProfile({
    displayName: "Synthetic Ash",
    username: "Ash.Handle",
    bio: "x".repeat(200),
    photo: "javascript:alert(1)",
    diagnosis: { year: 2001 },
    delivery: { method: "medtronic" },
    birthday: { month: 2, day: 29 },
  });
  assert.equal(p.bio!.length, 160);
  assert.equal(p.photo, undefined);
  assert.equal(p.username, "ash.handle");
  assert.equal(p.delivery!.method, "medtronic");
  const v = publicView(p, defaultPrivacy(), extras);
  assert.equal(v.shield, undefined);
  assert.equal(v.delivery, undefined);
  assert.equal(v.birthdayToday, undefined);
  assert.ok(!JSON.stringify(v).includes("2001"));
});
