import { test } from "node:test";
import assert from "node:assert/strict";
import { demoMember } from "../src/demo-members";

// Same list as `people` in src/store.tsx (that file cannot be loaded by the test runner).
const people = [
  "Alex Morgan",
  "Sam Rivera",
  "Priya Shah",
  "Jordan Lee",
  "Taylor Brooks",
  "Nia Williams",
  "Leo Chen",
  "Amara Okafor",
  "Morgan Ellis",
  "Jamie Patel",
];

test("every demo person has a matching entry", () => {
  for (const p of people) assert.equal(demoMember(p).name, p);
});

test("supporters carry no diabetes fields", () => {
  for (const n of ["Morgan Ellis", "Jamie Patel"]) {
    const m = demoMember(n);
    assert.ok(m.emblem === "supporter" || m.emblem === "caregiver");
    assert.equal(m.shield, undefined);
    assert.equal(m.diabetesType, undefined);
    assert.equal(m.cgm, undefined);
    assert.equal(m.delivery, undefined);
  }
});

test("at least six distinct tiers appear, some with the number hidden, some sharing nothing", () => {
  const ms = people.map(demoMember);
  const tiers = new Set(ms.flatMap((m) => (m.shield ? [m.shield.tier] : [])));
  assert.ok(tiers.size >= 6);
  assert.ok(ms.some((m) => m.shield && m.shield.years === undefined));
  assert.ok(ms.some((m) => !m.shield && !m.emblem && !m.cgm && !m.delivery));
});

test("no diagnosis dates and deterministic", () => {
  for (const p of people) {
    assert.equal("diagnosis" in demoMember(p), false);
    assert.deepEqual(demoMember(p), demoMember(p));
  }
});
