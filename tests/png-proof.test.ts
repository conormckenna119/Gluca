import { test } from "node:test";
import assert from "node:assert/strict";
import { photoFixture, pngProof } from "./e2e/png-proof";
test("synthetic photo fixture and decoded PNG evidence agree on dimensions and opacity", () => {
  assert.deepEqual(pngProof(photoFixture(64, 48, [20, 40, 80])), {
    width: 64,
    height: 48,
    transparent: 0,
    white: 0,
    pixels: 3072,
  });
  assert.equal(pngProof(photoFixture(7, 9, [255, 255, 255])).white, 63);
});
