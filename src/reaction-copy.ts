// All reaction wording lives here so the term can change after user testing by editing one object.
// Pure TypeScript. Positive reactions only; there is no negative kind.
import type { ReactionKind } from "./domain/reactions";

export type ReactionWords = {
  /** Singular noun, e.g. "Boost". */
  noun: string;
  /** Plural noun, e.g. "Boosts". */
  plural: string;
  /** Verb phrase for the button, e.g. "Give a Boost". */
  give: string;
  /** Button label while given, e.g. "Remove your Boost". */
  remove: string;
  /** Past tense after "You gave <name>", e.g. "a Boost". */
  gaveObject: string;
  /** Past participle used in "<n> people <x> your post", e.g. "Boosted". */
  done: string;
};

export const REACTION_WORDS: Record<ReactionKind, ReactionWords> = {
  boost: {
    noun: "Boost",
    plural: "Boosts",
    give: "Give a Boost",
    remove: "Remove your Boost",
    gaveObject: "a Boost",
    done: "Boosted",
  },
  love: {
    noun: "Love",
    plural: "Loves",
    give: "Send love",
    remove: "Remove your love",
    gaveObject: "some love",
    done: "sent love to",
  },
  celebrate: {
    noun: "Cheer",
    plural: "Cheers",
    give: "Give a Cheer",
    remove: "Remove your Cheer",
    gaveObject: "a Cheer",
    done: "Cheered",
  },
  support: {
    noun: "Support",
    plural: "Support",
    give: "Show support",
    remove: "Remove your support",
    gaveObject: "some support",
    done: "supported",
  },
  strength: {
    noun: "Strength",
    plural: "Strength",
    give: "Send strength",
    remove: "Remove your strength",
    gaveObject: "some strength",
    done: "sent strength to",
  },
};

export const CHEER_LINE = "Your community is cheering you on.";

export const firstName = (name: string): string =>
  name.trim().split(/\s+/)[0] || "them";

/** "You gave Sarah a Boost." */
export const gaveLine = (name: string, kind: ReactionKind = "boost"): string =>
  `You gave ${firstName(name)} ${REACTION_WORDS[kind].gaveObject}.`;

/** Count text under or beside a post. Empty for zero. */
export function countLine(
  n: number,
  ownPost = false,
  kind: ReactionKind = "boost",
): string {
  const count = Math.max(0, Math.floor(n));
  if (count === 0) return "";
  const w = REACTION_WORDS[kind];
  if (ownPost)
    return `${count} ${count === 1 ? "person" : "people"} ${w.done} your post`;
  return `${count} ${count === 1 ? w.noun : w.plural}`;
}

/** The cheer line shows on your own posts once there is at least one Boost. */
export const showCheerLine = (n: number, ownPost: boolean): boolean =>
  ownPost && n >= 1;

/** Accessible name for the button: action, then count. State is also exposed through accessibilityState. */
export function reactionLabel(
  n: number,
  given: boolean,
  kind: ReactionKind = "boost",
): string {
  const w = REACTION_WORDS[kind];
  const count = Math.max(0, Math.floor(n));
  return `${given ? w.remove : w.give}, ${count}`;
}

/** Rule: nobody can react to a post by someone they blocked. */
export const canReact = (author: string, blocked: readonly string[]): boolean =>
  !blocked.includes(author);

/** Counter for later participation medals: reflects Boosts currently given, never below zero. */
export const nextBoostsGiven = (current: number, given: boolean): number =>
  Math.max(0, (Number.isFinite(current) ? current : 0) + (given ? 1 : -1));
