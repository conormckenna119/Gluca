import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyEvent,
  editCabinet,
  emptyCabinet,
  validEvent,
} from "../src/achievements/events";
import { defaultProfile } from "../src/domain/profile";
import { anniversaryHits, ALL_RULES } from "../src/achievements/life";
import { persistableState } from "../src/private-persistence";
import { emptyState } from "../src/state";
import {
  captureAchievementScope,
  recordAchievementEvent,
  onAchievementEvent,
} from "../src/achievements/events";
import { sessionEvent } from "../src/services/session-events";

test("fictional participation facts award once without importing old prototype state", () => {
  let c = emptyCabinet();
  assert.equal(c.awards.length, 0);
  for (const kind of [
    "story_exported",
    "post_published",
    "activity_logged",
    "support_given",
    "awareness_confirmed",
    "milestone_confirmed",
  ] as const) {
    c = applyEvent(
      c,
      { id: `fictional-${kind}`, kind },
      "fictional-supporter",
      1000,
    );
    const before = c;
    assert.equal(
      applyEvent(
        c,
        { id: `fictional-${kind}`, kind },
        "fictional-supporter",
        2000,
      ),
      before,
    );
    c = applyEvent(
      c,
      { id: `fictional-again-${kind}`, kind },
      "fictional-supporter",
      3000,
    );
  }
  assert.equal(c.awards.length, 6);
  assert.ok(
    c.awards.every(
      (a) =>
        a.userId === "fictional-supporter" &&
        a.visibility === "private" &&
        !a.pinned &&
        a.ruleVersion === 2 &&
        a.relatedEvent,
    ),
  );
  c = applyEvent(
    c,
    { id: "fictional-comment-1", kind: "comment_added" },
    "fictional-supporter",
    4000,
  );
  c = applyEvent(
    c,
    { id: "fictional-comment-2", kind: "comment_added" },
    "fictional-supporter",
    5000,
  );
  assert.equal(
    c.awards.filter((a) => a.achievementId === "community_participation")
      .length,
    1,
  );
});
test("pin order, three-medal limit, hiding and collection opt-in are independent", () => {
  let c = emptyCabinet();
  for (const kind of [
    "story_exported",
    "post_published",
    "activity_logged",
    "support_given",
  ] as const)
    c = applyEvent(c, { id: kind, kind }, "fictional", 1000);
  const ids = c.awards.map((a) => a.id);
  for (const id of ids.slice(0, 3))
    c = editCabinet(c, { type: "pin", id, value: true });
  assert.throws(() => editCabinet(c, { type: "pin", id: ids[3], value: true }));
  c = editCabinet(c, { type: "reorder", ids: ids.slice(0, 3).reverse() });
  assert.deepEqual(
    c.awards.filter((a) => a.pinned).map((a) => a.id),
    ids.slice(0, 3).reverse(),
  );
  assert.throws(() =>
    editCabinet(c, { type: "reorder", ids: [ids[0], ids[0], ids[1]] }),
  );
  c = editCabinet(c, { type: "visibility", id: ids[0], value: true });
  assert.equal(c.public, false);
  c = editCabinet(c, { type: "public", value: true });
  c = editCabinet(c, { type: "visibility", id: ids[0], value: false });
  assert.equal(c.awards.find((a) => a.id === ids[0])?.visibility, "private");
  assert.throws(() =>
    editCabinet(c, { type: "pin", id: "someone-else", value: true }),
  );
});
test("anniversary needs exact supported day, repeats annually, and handles leap days", () => {
  for (const d of [
    { year: 2000 },
    { year: 2000, month: 3 },
    { year: 2000, month: 3, day: 1, approximate: true },
  ])
    assert.equal(anniversaryHits(d, new Date(2026, 2, 1).getTime()).length, 0);
  const profile = {
    ...defaultProfile(),
    role: "living" as const,
    diagnosis: { year: 2000, month: 2, day: 29 },
  };
  let c = emptyCabinet();
  for (const year of [2026, 2027, 2028]) {
    const now = new Date(year, 1, 29).getTime();
    c = applyEvent(
      c,
      { id: `fictional-year:${year}`, kind: "anniversary_checked" },
      "fictional",
      now,
      profile,
    );
  }
  assert.equal(c.awards.length, 3);
  assert.equal(
    anniversaryHits(profile.diagnosis, new Date(2026, 2, 2).getTime()).length,
    0,
  );
  assert.equal(
    applyEvent(
      emptyCabinet(),
      { id: "fictional", kind: "anniversary_checked" },
      "fictional",
      new Date(2026, 2, 1).getTime(),
      { ...profile, role: "supporting" },
    ).awards.length,
    0,
  );
});
test("no health awards through runtime registry, no plaintext award persistence, bounded receipts", () => {
  assert.ok(
    ALL_RULES.filter((r) => r.def.category === "health").every(
      (r) => r.def.disabled,
    ),
  );
  let c = emptyCabinet();
  for (let i = 0; i < 100; i++)
    c = applyEvent(
      c,
      { id: `fictional-${i}`, kind: "story_exported" },
      "fictional",
      1000 + i,
    );
  assert.equal(c.events.length, 1);
  assert.equal(
    validEvent({ id: "private text not allowed", kind: "story_exported" }),
    false,
  );
  assert.equal(validEvent({ id: "synthetic", kind: "glucose_low" }), false);
  assert.deepEqual(
    persistableState({ ...emptyState(), awards: c.awards }).awards,
    [],
  );
});
test("an export finishing after account switch cannot award the next account", () => {
  const captured = captureAchievementScope();
  const received: string[] = [];
  const stop = onAchievementEvent((e) => received.push(e.id));
  sessionEvent("lock");
  recordAchievementEvent("story_exported", "fictional-stale", captured);
  recordAchievementEvent("story_exported", "fictional-current");
  stop();
  assert.deepEqual(received, ["fictional-current"]);
});
