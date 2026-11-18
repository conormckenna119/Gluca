import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHALLENGES,
  enroll,
  leaveParticipation,
  challengeAvailable,
} from "../src/achievements/challenges";
import { getDef } from "../src/achievements/registry";
import { primaryTabFor, tabVisible } from "../src/nav";
import { resolveFlags } from "../src/flags";
test("five private nonmedical challenges reuse medal registry and one Community navigation entry", () => {
  assert.equal(CHALLENGES.length, 5);
  assert.equal(new Set(CHALLENGES.map((c) => c.id)).size, 5);
  for (const c of CHALLENGES) {
    assert.ok(getDef(c.medalId));
    assert.notEqual(getDef(c.medalId)?.category, "health");
    assert.equal(c.visibility, "private");
    assert.equal(c.eligibility, "all_accounts");
    assert.equal(c.repeatable, "once");
    assert.equal(c.flag, "communityChallenges");
  }
  assert.equal(primaryTabFor("/challenges"), "explore");
  assert.equal(
    tabVisible(
      "explore",
      resolveFlags("communityFeed=false,clubs=false,communityChallenges"),
    ),
    true,
  );
});
test("enrollment/leave/rejoin are explicit and dates/disabled rules are enforced", () => {
  const c = CHALLENGES[0],
    p = enroll(c, undefined, 100, "fictional-first");
  assert.equal(enroll(c, p, 200, "fictional-duplicate"), p);
  const left = leaveParticipation(p, p.enrollmentId, 300);
  assert.equal(left.status, "left");
  assert.equal(leaveParticipation(left, left.enrollmentId, 400), left);
  assert.throws(() => leaveParticipation(left, "stale", 400));
  const next = enroll(c, left, 500, "fictional-second");
  assert.equal(next.enrollmentId, "fictional-second");
  assert.equal(next.joinedAt, 500);
  const complete = { ...next, status: "completed" as const, completedAt: 600 };
  assert.equal(enroll(c, complete, 700, "another"), complete);
  assert.equal(
    leaveParticipation(complete, complete.enrollmentId, 700),
    complete,
  );
  for (const version of [
    { ...c, disabled: true },
    { ...c, startsAt: 1000 },
    { ...c, endsAt: 100 },
  ]) {
    assert.equal(challengeAvailable(version, 500), false);
    assert.throws(() => enroll(version, undefined, 500, "invalid"));
  }
  assert.equal(
    challengeAvailable({ ...c, startsAt: 500, endsAt: 600 }, 500),
    true,
  );
  assert.equal(
    challengeAvailable({ ...c, startsAt: 500, endsAt: 600 }, 600),
    false,
  );
});
