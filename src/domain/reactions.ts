// Social reactions. Boost is the only one shown; the others exist so more can be added without a data change.
// There are no negative reactions and there never will be a downvote kind.

export const REACTION_KINDS = ["boost", "love", "celebrate", "support", "strength"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

/** Kinds the interface offers today. The long-press picker (flag `reactionPicker`) may offer the rest. */
export const EXPOSED_REACTIONS: ReactionKind[] = ["boost"];
export const PRIMARY_REACTION: ReactionKind = "boost";

/**
 * Reactions on one post as this device sees them: a count per kind, and the one kind this person gave (or none).
 * One reaction per person per post: giving another kind replaces the first.
 */
export type PostReactions = {
  counts: Partial<Record<ReactionKind, number>>;
  mine: ReactionKind | null;
};

export const emptyReactions = (): PostReactions => ({ counts: {}, mine: null });
export const isReactionKind = (v: unknown): v is ReactionKind =>
  typeof v === "string" && (REACTION_KINDS as readonly string[]).includes(v);

export const reactionCount = (r: PostReactions, kind: ReactionKind = PRIMARY_REACTION): number => r.counts[kind] ?? 0;

/** Tap a kind: gives it, moves an existing reaction to it, or takes it back when it is already mine. Counts never go below zero. */
export function toggleReaction(r: PostReactions, kind: ReactionKind = PRIMARY_REACTION): PostReactions {
  const counts = { ...r.counts };
  const dec = (k: ReactionKind) => {
    counts[k] = Math.max(0, (counts[k] ?? 0) - 1);
  };
  if (r.mine === kind) {
    dec(kind);
    return { counts, mine: null };
  }
  if (r.mine) dec(r.mine);
  counts[kind] = (counts[kind] ?? 0) + 1;
  return { counts, mine: kind };
}

/** Keep well-formed reactions from saved data; older posts stored `kudos` and `liked`, which become Boosts. */
export function sanitizeReactions(raw: unknown, legacy?: { kudos?: unknown; liked?: unknown }): PostReactions {
  const out = emptyReactions();
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as { counts?: unknown; mine?: unknown };
    if (r.counts && typeof r.counts === "object") {
      for (const k of REACTION_KINDS) {
        const n = (r.counts as Record<string, unknown>)[k];
        if (typeof n === "number" && Number.isInteger(n) && n > 0) out.counts[k] = n;
      }
    }
    if (isReactionKind(r.mine)) out.mine = r.mine;
  } else if (legacy) {
    const n = legacy.kudos;
    if (typeof n === "number" && Number.isInteger(n) && n > 0) out.counts.boost = n;
    if (legacy.liked === true) out.mine = "boost";
  }
  // My own reaction is always counted.
  if (out.mine && !out.counts[out.mine]) out.counts[out.mine] = 1;
  return out;
}
