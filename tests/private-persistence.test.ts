import { test } from "node:test";
import assert from "node:assert/strict";
import {
  persistableState,
  removeLegacyPlaintextHistory,
} from "../src/private-persistence";
import { emptyState } from "../src/state";
test("raw CSV history remains usable in memory but is never serialized into the public demo store", () => {
  const state = emptyState();
  state.imported = [{ timestamp: 1735689600000, mgdl: 123, source: "csv" }];
  state.dark = false;
  const stored = persistableState(state);
  assert.equal(state.imported.length, 1);
  assert.equal(stored.imported.length, 0);
  assert.equal(stored.dark, false);
  assert.ok(!JSON.stringify(stored).includes("1735689600000"));
});
test("legacy plaintext CGM cache is purged without deleting ordinary preferences or explicit posts", () => {
  const state = emptyState();
  state.imported = [{ timestamp: 1735689600000, mgdl: 123, source: "csv" }];
  state.dark = false;
  const result = removeLegacyPlaintextHistory(JSON.stringify(state));
  assert.equal(result.removed, true);
  assert.equal(JSON.parse(result.raw).imported.length, 0);
  assert.equal(JSON.parse(result.raw).dark, false);
  assert.equal(removeLegacyPlaintextHistory(result.raw).removed, false);
});
