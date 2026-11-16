import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, loadState } from "../src/state";
import { defaultPrivacy, isValidPartialDate, sanitizePrivacy, sanitizeProfile, PRIVACY_KEYS } from "../src/domain/profile";
import { emptyReactions, reactionCount, sanitizeReactions, toggleReaction, EXPOSED_REACTIONS, REACTION_KINDS } from "../src/domain/reactions";
import { awardId, sanitizeAwards, sanitizeChallenges, sanitizeCounters, MAX_PINNED, type Award } from "../src/domain/achievements";
import { DEFAULT_FLAGS } from "../src/flags";

const award = (id: string, over: Partial<Award> = {}): Award => ({
  id: awardId("me", id, ""), userId: "me", achievementId: id, awardedAt: 1, periodKey: "", ruleVersion: 1,
  visibility: "private", pinned: false, ...over,
});

test("state saved before identity existed loads with nothing shared and nothing earned", () => {
  const old = JSON.stringify({ posts: [], following: ["Sam Rivera"], clubs: ["Type 1 Runners"], unit: "mmol/L" });
  const s = loadState(old, emptyState());
  assert.deepEqual(s.privacy, defaultPrivacy());
  assert.equal(Object.values(s.privacy).some(Boolean), false);
  assert.deepEqual(s.profile, { displayName: "You", onboarded: false, interests: [] });
  assert.deepEqual(s.awards, []);
  assert.deepEqual(s.clubVisibility, {});
  assert.deepEqual(s.clubs, ["Type 1 Runners"]);
  assert.equal(s.unit, "mmol/L");
});

test("old kudos and liked become Boosts, and the old fields are dropped", () => {
  const old = JSON.stringify({
    posts: [
      { id: "a", author: "x", title: "t", caption: "c", visibility: "public", kudos: 5, liked: true, saved: false, comments: [] },
      { id: "b", author: "x", title: "t", caption: "c", visibility: "public", kudos: 0, liked: false, saved: false, comments: [] },
    ],
  });
  const [a, b] = loadState(old, emptyState()).posts;
  assert.deepEqual(a.reactions, { counts: { boost: 5 }, mine: "boost" });
  assert.deepEqual(b.reactions, { counts: {}, mine: null });
  assert.equal("kudos" in a, false);
  assert.equal("liked" in a, false);
});

test("saved reactions are kept, and bad counts or kinds are dropped", () => {
  assert.deepEqual(sanitizeReactions({ counts: { boost: 2, love: 1 }, mine: "love" }), { counts: { boost: 2, love: 1 }, mine: "love" });
  assert.deepEqual(sanitizeReactions({ counts: { boost: -3, downvote: 9, love: 1.5 }, mine: "downvote" }), emptyReactions());
  // My own reaction is always counted, even if the saved count lost it.
  assert.deepEqual(sanitizeReactions({ counts: {}, mine: "boost" }), { counts: { boost: 1 }, mine: "boost" });
});

test("a Boost is one per person per post: tap gives, tap again takes back, counts never go negative", () => {
  let r = emptyReactions();
  r = toggleReaction(r);
  assert.deepEqual(r, { counts: { boost: 1 }, mine: "boost" });
  r = toggleReaction(r);
  assert.deepEqual(r, { counts: { boost: 0 }, mine: null });
  assert.equal(reactionCount(toggleReaction({ counts: {}, mine: "boost" })), 0);
  // Choosing another kind moves the reaction rather than adding a second one.
  r = toggleReaction(toggleReaction({ counts: { boost: 4 }, mine: null }), "celebrate");
  assert.deepEqual(r, { counts: { boost: 4, celebrate: 1 }, mine: "celebrate" });
});

test("only Boost is exposed, and there is no negative reaction kind", () => {
  assert.deepEqual(EXPOSED_REACTIONS, ["boost"]);
  for (const k of REACTION_KINDS) assert.doesNotMatch(k, /down|dislike|negative/);
});

test("partial dates: a day needs a month, and impossible dates are rejected", () => {
  assert.ok(isValidPartialDate({ year: 2009 }));
  assert.ok(isValidPartialDate({ year: 2009, month: 3 }));
  assert.ok(isValidPartialDate({ year: 2012, month: 2, day: 29 }));
  assert.ok(isValidPartialDate({ year: 2009, approximate: true }));
  assert.equal(isValidPartialDate({ year: 2011, month: 2, day: 29 }), false);
  assert.equal(isValidPartialDate({ year: 2009, day: 4 }), false);
  assert.equal(isValidPartialDate({ year: 2009, month: 13 }), false);
  assert.equal(isValidPartialDate({ year: "2009" }), false);
  assert.equal(isValidPartialDate({ year: 1800 }), false);
});

test("profile sanitizer keeps known values, trims text and never invents a missing date part", () => {
  const p = sanitizeProfile({
    displayName: "  Conor  ", onboarded: true, role: "living", diabetesType: "type1",
    diagnosis: { year: 2006, month: 5 }, cgm: { brand: "dexcom", model: " G7 " },
    delivery: { method: "tandem", model: "x".repeat(80) }, emblem: "wizard", monitoring: "telepathy",
    interests: ["running", "running", " ", 4, "golf"], extra: "ignored",
  });
  assert.equal(p.displayName, "Conor");
  assert.deepEqual(p.diagnosis, { year: 2006, month: 5 });
  assert.deepEqual(p.cgm, { brand: "dexcom", model: "G7" });
  assert.equal(p.delivery?.model?.length, 40);
  assert.equal(p.emblem, undefined);
  assert.equal(p.monitoring, undefined);
  assert.deepEqual(p.interests, ["running", "golf"]);
  assert.equal("extra" in p, false);
  assert.deepEqual(sanitizeProfile(null), { displayName: "You", onboarded: false, interests: [] });
});

test("privacy: only an exact true turns a switch on", () => {
  const p = sanitizePrivacy({ showShield: true, showCgm: "yes", showBirthday: 1, healthAchievements: null });
  assert.equal(p.showShield, true);
  for (const k of PRIVACY_KEYS) if (k !== "showShield") assert.equal(p[k], false, k);
  assert.deepEqual(sanitizePrivacy("corrupt"), defaultPrivacy());
});

test("awards: malformed and duplicate awards are dropped and at most three stay pinned", () => {
  const list = [
    award("first_post", { pinned: true }), award("first_post", { pinned: true }),
    award("a", { pinned: true }), award("b", { pinned: true }), award("c", { pinned: true }),
    award("d", { pinned: true, withdrawn: { at: 2, reason: "bad data" } }),
    { ...award("e"), id: "wrong" }, { ...award("f"), visibility: "everyone" }, { ...award("g"), snapshot: { nested: {} } }, null,
  ];
  const out = sanitizeAwards(list);
  assert.deepEqual(out.map((a) => a.achievementId), ["first_post", "a", "b", "c", "d"]);
  assert.equal(out.filter((a) => a.pinned).length, MAX_PINNED);
  assert.equal(out.find((a) => a.achievementId === "d")!.pinned, false);
  assert.deepEqual(sanitizeAwards("x"), []);
});

test("counters and challenges ignore bad saved values", () => {
  assert.deepEqual(sanitizeCounters({ exports: 3, boostsGiven: -1, commentsMade: "2" }), {
    exports: 3, boostsGiven: 0, commentsMade: 0, communitiesJoined: 0, challengesCompleted: 0,
  });
  assert.deepEqual(sanitizeChallenges([{ id: "share", completedAt: 5 }, { id: "share", completedAt: 6 }, { id: "", completedAt: 1 }, 7]), [
    { id: "share", completedAt: 5 },
  ]);
});

test("club visibility only keeps clubs explicitly marked visible", () => {
  const s = loadState(JSON.stringify({ clubVisibility: { "Type 1 Runners": true, "Diabetic Golfers": "yes", x: false } }), emptyState());
  assert.deepEqual(s.clubVisibility, { "Type 1 Runners": true });
});

test("new features ship off, and health achievements are off by default", () => {
  for (const f of ["identity", "boosts", "achievements", "healthAchievements", "reactionPicker", "dexcomApi", "accounts"] as const)
    assert.equal(DEFAULT_FLAGS[f], false, f);
});
