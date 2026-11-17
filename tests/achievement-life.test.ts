import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState } from "../src/state";
import { DEFAULT_FLAGS } from "../src/flags";
import { emptyReactions } from "../src/domain/reactions";
import type { State } from "../src/types";
import { evaluateAwards } from "../src/achievements/engine";
import {
  ALL_RULES,
  LIFE_RULES,
  anniversaryHits,
} from "../src/achievements/life";
import { ALL_DEFS, getDef } from "../src/achievements/registry";
import { CHALLENGES, completeChallenge } from "../src/achievements/challenges";

const flags = { ...DEFAULT_FLAGS, achievements: true };
const blank = (): State => ({
  ...emptyState(),
  posts: [],
  events: [],
  clubs: [],
  challenges: [],
});
const ids = (s: State, now = new Date(2026, 10, 16).getTime()) =>
  evaluateAwards(ALL_RULES, { state: s, now, flags }).added.map(
    (a) => a.achievementId,
  );

test("nothing is earned from an empty state", () => {
  assert.deepEqual(ids(blank()), []);
});

test("first post needs a post by You", () => {
  const post = {
    id: "p",
    author: "Sam",
    title: "",
    caption: "",
    visibility: "public" as const,
    reactions: emptyReactions(),
    saved: false,
    comments: [],
  };
  assert.deepEqual(ids({ ...blank(), posts: [post as never] }), []);
  assert.deepEqual(
    ids({ ...blank(), posts: [{ ...post, author: "You" } as never] }),
    ["first_post"],
  );
});

test("first activity, first export, community and support rules", () => {
  const s = blank();
  assert.deepEqual(
    ids({
      ...s,
      events: [{ id: "e", kind: "meal", start: 1, durationMin: 0 }],
    }),
    [],
  );
  assert.deepEqual(
    ids({
      ...s,
      events: [{ id: "e", kind: "activity", start: 1, durationMin: 20 }],
    }),
    ["first_activity"],
  );
  assert.deepEqual(ids({ ...s, counters: { ...s.counters, exports: 1 } }), [
    "first_story",
  ]);
  assert.deepEqual(
    ids({ ...s, counters: { ...s.counters, communitiesJoined: 1 } }),
    ["community_participation"],
  );
  assert.deepEqual(ids({ ...s, clubs: ["Type 1 Runners"] }), [
    "community_participation",
  ]);
  assert.deepEqual(ids({ ...s, counters: { ...s.counters, boostsGiven: 1 } }), [
    "first_support",
  ]);
  assert.deepEqual(
    ids({ ...s, counters: { ...s.counters, commentsMade: 2 } }),
    ["first_support"],
  );
});

test("challenge-based awards", () => {
  const s = blank();
  const done = (id: string) => ({ ...s, challenges: [{ id, completedAt: 1 }] });
  assert.deepEqual(ids(done("personal_milestone")), ["personal_milestone"]);
  assert.deepEqual(ids(done("awareness_event")), ["awareness_contribution"]);
  assert.deepEqual(ids(done("activity_of_choice")), [
    "activity_accomplishment",
  ]);
  assert.deepEqual(ids(done("share_moment")), []);
});

test("diagnosis anniversary uses the local calendar and never invents dates", () => {
  const nov16 = new Date(2026, 10, 16, 9).getTime();
  assert.equal(
    anniversaryHits({ year: 2015, month: 11, day: 16 }, nov16).length,
    1,
  );
  assert.equal(
    anniversaryHits({ year: 2015, month: 11, day: 17 }, nov16).length,
    0,
  );
  assert.equal(anniversaryHits({ year: 2015, month: 11 }, nov16).length, 0); // month alone does not establish an anniversary
  assert.equal(anniversaryHits({ year: 2015, month: 12 }, nov16).length, 0);
  assert.equal(anniversaryHits({ year: 2015 }, nov16).length, 0); // year only: never
  assert.equal(
    anniversaryHits({ year: 2026, month: 1, day: 1 }, nov16).length,
    0,
  ); // not before the first anniversary
  assert.equal(anniversaryHits(undefined, nov16).length, 0);
  assert.equal(
    anniversaryHits({ year: 2015, month: 11, day: 16 }, nov16)[0].periodKey,
    "2026",
  );
  const s = {
    ...blank(),
    profile: {
      ...blank().profile,
      diagnosis: { year: 2015, month: 11, day: 16 },
    },
  };
  const first = evaluateAwards(ALL_RULES, { state: s, now: nov16, flags });
  assert.equal(first.added[0].snapshot, undefined);
  assert.equal(first.added[0].periodKey, "2026");
  const next = evaluateAwards(ALL_RULES, {
    state: { ...s, awards: first.awards },
    now: new Date(2027, 10, 16).getTime(),
    flags,
  });
  assert.deepEqual(
    next.added.map((a) => a.id),
    ["me:diagnosis_anniversary:2027"],
  );
});

test("every life def is private, flagged and not a health achievement", () => {
  for (const { def } of LIFE_RULES) {
    assert.equal(def.flag, "achievements");
    assert.equal(def.safetyReview, "not_required");
    assert.equal(def.needsHealthOptIn, false);
    assert.equal(def.defaultVisibility, "private");
    assert.notEqual(def.category, "health");
    assert.equal(
      def.requiredData.includes("glucose") || def.requiredData.includes("a1c"),
      false,
    );
  }
  assert.equal(getDef("first_post")?.id, "first_post");
  assert.equal(new Set(ALL_DEFS.map((d) => d.id)).size, ALL_DEFS.length);
});

test("completing a challenge is idempotent and bumps the counter once", () => {
  const s = blank();
  const a = completeChallenge(s, "share_moment", 5);
  assert.equal(a.counters.challengesCompleted, 1);
  assert.deepEqual(a.challenges, [{ id: "share_moment", completedAt: 5 }]);
  const b = completeChallenge({ ...s, ...a }, "share_moment", 9);
  assert.equal(b.counters.challengesCompleted, 1);
  assert.deepEqual(b.challenges, a.challenges);
  assert.equal(completeChallenge(s, "nope", 1).challenges.length, 0);
  assert.equal(CHALLENGES.length, 5);
});

test("no banned wording in achievement or challenge text", () => {
  const banned =
    /\b(streaks?|leaderboards?|rank(s|ed|ing)?|lowest|records?|beat|beats|perfect|fasting|doses?|dosing)\b/i;
  const texts = [
    ...ALL_DEFS.flatMap((d) => [d.name, d.description]),
    ...CHALLENGES.flatMap((c) => [c.title, c.prompt, c.howToComplete]),
  ];
  for (const t of texts)
    assert.equal(banned.test(t), false, `banned wording in: ${t}`);
});
