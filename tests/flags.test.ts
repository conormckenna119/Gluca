import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FLAGS, parseOverrides, configureFlags, isEnabled } from "../src/flags";

test("defaults: MVP and demo community flags are on, everything else is off", () => {
  for (const name of ["shareFirstMvp", "localCsvImport", "communityFeed", "clubs"] as const) {
    assert.equal(DEFAULT_FLAGS[name], true, name);
  }
  for (const name of ["eventLogging", "accounts", "dexcomApi", "appleHealth", "glucoseTimeline", "activities", "wrapped", "vizGallery"] as const) {
    assert.equal(DEFAULT_FLAGS[name], false, name);
  }
});

test("parseOverrides ignores unknown names and malformed entries", () => {
  assert.deepEqual(parseOverrides("nope,eventLogging,clubs=false,wrapped=maybe,=true,,"), { eventLogging: true, clubs: false });
});

test("parseOverrides of undefined or empty string is empty", () => {
  assert.deepEqual(parseOverrides(undefined), {});
  assert.deepEqual(parseOverrides(""), {});
});

test("parseOverrides tolerates whitespace around entries", () => {
  assert.deepEqual(parseOverrides(" eventLogging , clubs=false "), { eventLogging: true, clubs: false });
});

test("configureFlags applies overrides and undefined restores defaults", () => {
  try {
    configureFlags("communityFeed=false");
    assert.equal(isEnabled("communityFeed"), false);
    assert.equal(isEnabled("clubs"), true);
    assert.equal(isEnabled("eventLogging"), false);
    assert.equal(isEnabled("shareFirstMvp"), true);
  } finally {
    configureFlags(undefined);
  }
  assert.equal(isEnabled("communityFeed"), true);
  assert.equal(isEnabled("eventLogging"), false);
});
