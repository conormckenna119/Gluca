import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shieldPrecisionNote,
  shieldFor,
  shieldLabel,
  SHIELD_TIERS,
  nextAnniversary,
} from "../src/domain/shield";
import { publicView } from "../src/domain/public-view";
import {
  defaultPrivacy,
  defaultProfile,
  type PartialDate,
} from "../src/domain/profile";
test("partial dates cross every retained colour milestone conservatively without inventing parts", () => {
  for (const style of SHIELD_TIERS.slice(1)) {
    for (const diagnosis of [
      { year: 1970, month: 6 },
      { year: 1970 },
    ] as PartialDate[]) {
      const original = JSON.stringify(diagnosis),
        y = 1970 + style.minYears;
      const before = shieldFor(
        diagnosis,
        diagnosis.month
          ? { year: y, month: 6, day: 30 }
          : { year: y, month: 12, day: 31 },
      )!;
      const after = shieldFor(
        diagnosis,
        diagnosis.month
          ? { year: y, month: 7, day: 1 }
          : { year: y + 1, month: 1, day: 1 },
      )!;
      assert.equal(before.years, style.minYears - 1);
      assert.equal(after.years, style.minYears);
      assert.equal(after.tier.id, style.id);
      assert.equal(
        nextAnniversary(diagnosis, { year: y, month: 8, day: 1 }),
        null,
      );
      assert.equal(JSON.stringify(diagnosis), original);
    }
  }
});
test("precision explanations describe the known calendar span and never interpolate or expose a private date", () => {
  assert.match(
    shieldPrecisionNote({ year: 2008, month: 2, day: 29 }),
    /Completed years/,
  );
  assert.match(
    shieldPrecisionNote({ year: 2008, month: 2 }),
    /whole anniversary month/,
  );
  assert.match(shieldPrecisionNote({ year: 2008 }), /no anniversary date/);
  assert.match(
    shieldPrecisionNote({ year: 2008, month: 2, day: 29, approximate: true }),
    /estimate/,
  );
  assert.match(shieldPrecisionNote(undefined, false), /partial or estimated/);
  for (const d of [
    { year: 2008 },
    { year: 2008, month: 2 },
    { year: 2008, month: 2, day: 29, approximate: true },
  ])
    assert.doesNotMatch(shieldPrecisionNote(d), /2008|February|29/);
});
test("visible and spoken styles keep neutral wording and obey number visibility", () => {
  for (const style of SHIELD_TIERS) {
    assert.doesNotMatch(
      shieldLabel(style, 52, false),
      /\btier\b|\blevel\b|\brank\b|upgrade|prestige|≈/i,
    );
    assert.match(shieldLabel(style, 52, false), /limited date precision/);
    assert.doesNotMatch(shieldLabel(style, 52, false, false), /52|limited/);
  }
});
test("public detail inputs contain no diagnosis date even when the shield is explicitly public", () => {
  const profile = {
    ...defaultProfile(),
    role: "living" as const,
    diagnosis: { year: 2008, month: 2, day: 29, approximate: true },
  };
  const extras = {
    today: { year: 2026, month: 11, day: 17 },
    clubs: [],
    clubVisibility: {},
    awards: [],
  };
  const visible = publicView(
    profile,
    { ...defaultPrivacy(), showShield: true, showShieldNumber: true },
    extras,
  );
  assert.equal(visible.shield?.certain, false);
  assert.equal(visible.shield?.years, 18);
  assert.doesNotMatch(JSON.stringify(visible), /diagnosis|2008|month|day/);
  const hidden = publicView(
    profile,
    { ...defaultPrivacy(), showShield: true },
    extras,
  );
  assert.equal(hidden.shield?.years, undefined);
  assert.equal(publicView(profile, defaultPrivacy(), extras).shield, undefined);
});
