import test from "node:test";
import assert from "node:assert/strict";
import { REACTION_KINDS } from "../src/domain/reactions";
import {
  CHEER_LINE,
  REACTION_WORDS,
  canReact,
  countLine,
  firstName,
  gaveLine,
  nextBoostsGiven,
  reactionLabel,
  showCheerLine,
} from "../src/reaction-copy";

test("every reaction kind has wording", () => {
  for (const k of REACTION_KINDS) {
    const w = REACTION_WORDS[k];
    assert.ok(w.noun && w.give && w.remove && w.gaveObject && w.done);
  }
});

test("gave line uses the first name", () => {
  assert.equal(gaveLine("Sarah"), "You gave Sarah a Boost.");
  assert.equal(gaveLine("Sarah Jones"), "You gave Sarah a Boost.");
  assert.equal(firstName("  "), "them");
});

test("count line pluralises for own and other posts", () => {
  assert.equal(countLine(0), "");
  assert.equal(countLine(0, true), "");
  assert.equal(countLine(1, true), "1 person Boosted your post");
  assert.equal(countLine(24, true), "24 people Boosted your post");
  assert.equal(countLine(1), "1 Boost");
  assert.equal(countLine(24), "24 Boosts");
});

test("cheer line only for own posts with a Boost", () => {
  assert.equal(CHEER_LINE, "Your community is cheering you on.");
  assert.equal(showCheerLine(0, true), false);
  assert.equal(showCheerLine(1, true), true);
  assert.equal(showCheerLine(5, false), false);
});

test("accessible labels include action and count", () => {
  assert.equal(reactionLabel(3, false), "Give a Boost, 3");
  assert.equal(reactionLabel(4, true), "Remove your Boost, 4");
  assert.equal(reactionLabel(0, false), "Give a Boost, 0");
});

test("blocked authors cannot be given a Boost", () => {
  assert.equal(canReact("Sam", ["Sam"]), false);
  assert.equal(canReact("Ana", ["Sam"]), true);
});

test("boostsGiven follows Boosts currently given and never goes below zero", () => {
  assert.equal(nextBoostsGiven(0, true), 1);
  assert.equal(nextBoostsGiven(1, false), 0);
  assert.equal(nextBoostsGiven(0, false), 0);
});
