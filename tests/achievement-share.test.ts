import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shareRoute,
  shareText,
  readShareParams,
} from "../src/achievement-share";
import { ALL_DEFS } from "../src/achievements/registry";

test("share text comes from the name only and respects limits", () => {
  for (const d of ALL_DEFS) {
    const t = shareText(d);
    assert.ok(
      t.headline.length <= 90 && t.big.length <= 24 && t.big.length > 0,
    );
    assert.ok(t.headline.includes(d.name.slice(0, 20)));
  }
});

test("no snapshot value can appear in the route", () => {
  const def = { name: "First post", snapshot: { tir: 87.5, avg: 143 } } as {
    name: string;
  };
  const url = decodeURIComponent(shareRoute(def));
  assert.ok(!/87|143|tir|avg|mg/i.test(url));
  assert.ok(url.startsWith("/create?template=milestone&headline="));
});

test("long names are clipped and encoded", () => {
  const r = shareRoute({ name: "A ".repeat(80) + "&=?#" });
  assert.ok(!/[&=?#]\s/.test(r.split("headline=")[1].split("&big=")[0]));
  assert.ok(decodeURIComponent(r.split("big=")[1]).length <= 24);
});

test("readShareParams clamps and ignores empties", () => {
  assert.deepEqual(readShareParams({}), {
    headline: undefined,
    big: undefined,
  });
  const r = readShareParams({
    headline: "x".repeat(200),
    big: ["y".repeat(50)],
  });
  assert.equal(r.headline!.length, 90);
  assert.equal(r.big!.length, 24);
});
