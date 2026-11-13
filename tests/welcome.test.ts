import { test } from "node:test";
import assert from "node:assert/strict";
import { loadState, hasImported, removeImported, DEFAULT_RANGE } from "../src/state";
import type { Reading, State } from "../src/types";

const defaults: State = {
  posts: [], following: [], clubs: [], blocked: [], reports: [], unit: "mg/dL",
  range: { ...DEFAULT_RANGE }, dark: true, imported: [], seenWelcome: false,
};
const reading: Reading = { timestamp: 1, mgdl: 100, source: "csv" };

test("a brand-new install (nothing saved) has not seen the welcome screen", () => {
  assert.equal(loadState(null, defaults).seenWelcome, false);
  assert.equal(loadState(undefined, defaults).seenWelcome, false);
});

test("saved state from before the field existed counts as already welcomed", () => {
  const old = JSON.stringify({ unit: "mg/dL", dark: true, posts: [], imported: [] });
  assert.equal(loadState(old, defaults).seenWelcome, true);
  assert.equal(loadState("{}", defaults).seenWelcome, true);
});

test("an explicit saved seenWelcome is kept; a non-boolean counts as welcomed", () => {
  assert.equal(loadState(JSON.stringify({ seenWelcome: false }), defaults).seenWelcome, false);
  assert.equal(loadState(JSON.stringify({ seenWelcome: true }), defaults).seenWelcome, true);
  assert.equal(loadState(JSON.stringify({ seenWelcome: "no" }), defaults).seenWelcome, true);
});

test("removeImported clears readings only and hasImported reflects it", () => {
  const s: State = { ...defaults, imported: [reading], following: ["Sam Rivera"], seenWelcome: true };
  assert.equal(hasImported(s), true);
  const r = removeImported(s);
  assert.deepEqual(r.imported, []);
  assert.equal(hasImported(r), false);
  assert.deepEqual(r.following, ["Sam Rivera"]);
  assert.equal(r.seenWelcome, true);
  assert.equal(s.imported.length, 1); // input not mutated
});
