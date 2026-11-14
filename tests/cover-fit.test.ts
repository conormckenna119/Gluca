import assert from "node:assert/strict";
import { test } from "node:test";
import { coverFit } from "../src/cover-fit";

const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);

test("portrait photo into 1080x1920 (same ratio) is not cropped", () => {
  const r = coverFit(1080, 1920, 1080, 1920);
  assert.deepEqual(r, { sx: 0, sy: 0, sw: 1080, sh: 1920 });
});

test("portrait photo 3000x4000 into 1080x1350 crops top and bottom", () => {
  const r = coverFit(3000, 4000, 1080, 1350);
  close(r.sw, 3000);
  close(r.sh, 3000 / 0.8);
  close(r.sx, 0);
  close(r.sy, (4000 - 3750) / 2);
});

test("portrait photo into 1080x1080 square", () => {
  const r = coverFit(1000, 2000, 1080, 1080);
  assert.deepEqual(r, { sx: 0, sy: 500, sw: 1000, sh: 1000 });
});

test("portrait photo 1000x2000 into 1080x1920 crops top and bottom", () => {
  const r = coverFit(1000, 2000, 1080, 1920);
  close(r.sw, 1000);
  close(r.sh, 1000 / (1080 / 1920));
  close(r.sy, (2000 - r.sh) / 2);
});

test("landscape photo into 1080x1920 crops the sides, centred", () => {
  const r = coverFit(4000, 3000, 1080, 1920);
  close(r.sh, 3000);
  close(r.sw, 3000 * (1080 / 1920));
  close(r.sx, (4000 - r.sw) / 2);
  close(r.sy, 0);
});

test("degenerate sizes do not throw or produce NaN", () => {
  const r = coverFit(0, 0, 1080, 1080);
  assert.equal(r.sw, 0);
});
