import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMMUNITY_CATALOGUE,
  discoverCommunities,
  recommendedCommunityIds,
  getCommunity,
} from "../src/domain/community-discovery";
import { defaultProfile, type Profile } from "../src/domain/profile";
const today = { year: 2026, month: 11, day: 18 };
const p = (x: Partial<Profile>): Profile => ({ ...defaultProfile(), ...x });
test("configured communities reuse stable IDs, include requested interests, and search/filter without a profile", () => {
  assert.equal(new Set(COMMUNITY_CATALOGUE.map((c) => c.id)).size, 12);
  for (const id of [
    "dexcom-g7",
    "tandem",
    "omnipod",
    "twiist",
    "libre",
    "mdi",
    "newly-diagnosed-t1d",
    "long-term-t1d",
    "diabetic-runners",
    "supporters",
    "advocacy",
  ])
    assert.ok(getCommunity(id));
  assert.equal(getCommunity("unknown"), undefined);
  assert.deepEqual(
    discoverCommunities("  LIBRE  ", "Devices").map((c) => c.id),
    ["libre"],
  );
  assert.equal(discoverCommunities("tandem", "Support").length, 0);
  assert.ok(discoverCommunities("", "All").length === 12);
});
test("recommendations use only explicit voluntary fields, preserve inputs and never enroll", () => {
  const profile = p({
      role: "living",
      cgm: { brand: "dexcom", model: "G7" },
      delivery: { method: "tandem" },
    }),
    before = JSON.stringify(profile);
  assert.deepEqual(recommendedCommunityIds(profile, today), [
    "dexcom-g7",
    "tandem",
  ]);
  assert.deepEqual(recommendedCommunityIds(profile, today, ["dexcom-g7"]), [
    "tandem",
  ]);
  assert.equal(JSON.stringify(profile), before);
  assert.deepEqual(recommendedCommunityIds(defaultProfile(), today), []);
  assert.deepEqual(
    recommendedCommunityIds(
      p({ cgm: { brand: "dexcom", model: "G7" } }),
      today,
    ),
    [],
  );
  assert.deepEqual(
    recommendedCommunityIds(
      p({
        role: "living",
        cgm: { brand: "prefer_not" },
        delivery: { method: "prefer_not" },
        diabetesType: "prefer_not",
        diagnosis: { year: 2000 },
      }),
      today,
    ),
    [],
  );
});
test("supporters and advocates can receive interest suggestions without diabetes or a Dexcom account", () => {
  assert.deepEqual(
    recommendedCommunityIds(
      p({ role: "supporting", emblem: "caregiver", interests: ["running"] }),
      today,
    ),
    ["diabetic-runners", "supporters", "parents-caregivers"],
  );
  assert.deepEqual(recommendedCommunityIds(p({ role: "awareness" }), today), [
    "advocacy",
  ]);
  assert.deepEqual(
    recommendedCommunityIds(
      p({
        role: "living",
        cgm: { brand: "libre" },
        delivery: { method: "pens" },
      }),
      today,
    ),
    ["libre", "mdi"],
  );
});
test("diagnosis recommendations do not invent anniversary precision and support longer experience across types", () => {
  const profile = p({
    role: "living",
    diabetesType: "type1",
    diagnosis: { year: 2026, month: 2, day: 4 },
  });
  assert.deepEqual(recommendedCommunityIds(profile, today), [
    "newly-diagnosed-t1d",
  ]);
  for (const diagnosis of [
    { year: 2026 },
    { year: 2026, month: 2 },
    { year: 2026, month: 2, day: 4, approximate: true },
  ])
    assert.deepEqual(
      recommendedCommunityIds({ ...profile, diagnosis }, today),
      [],
    );
  assert.deepEqual(
    recommendedCommunityIds(
      p({ role: "living", diabetesType: "type2", diagnosis: { year: 2000 } }),
      today,
    ),
    ["long-term-t1d"],
  );
});
