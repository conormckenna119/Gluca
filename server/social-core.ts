import { membership } from "./community-access";
import { decrypt } from "./crypto";
import { HttpError, type Ctx } from "./http";
import { sanitizeProfile, sanitizePrivacy } from "../src/domain/profile";
import { publicView } from "../src/domain/public-view";
import { localToday } from "../src/domain/shield";

export function blocked(ctx: Ctx, other: string) {
  return !!ctx.deps.db
    .prepare(
      "SELECT 1 FROM user_blocks WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)",
    )
    .get(ctx.session!.userId, other, other, ctx.session!.userId);
}
export function member(ctx: Ctx, id: string) {
  if (
    !ctx.deps.db.prepare("SELECT 1 FROM users WHERE id=?").get(id) ||
    blocked(ctx, id)
  )
    throw new HttpError(404, "not_found", "Member unavailable.");
}
export function publicIdentity(ctx: Ctx, owner: string) {
  const r = ctx.deps.db
    .prepare("SELECT payload_enc FROM user_profiles WHERE user_id=?")
    .get(owner) as { payload_enc: string } | undefined;
  const p =
    r && ctx.deps.tokenKey
      ? JSON.parse(
          decrypt(r.payload_enc, ctx.deps.tokenKey, `profile:v1:${owner}`),
        )
      : {};
  return publicView(sanitizeProfile(p.profile), sanitizePrivacy(p.privacy), {
    today: localToday(new Date(ctx.deps.now())),
    clubs: [],
    clubVisibility: {},
    awards: [],
  });
}
export function accessiblePost(ctx: Ctx, id: string, writable = false) {
  const r = ctx.deps.db
    .prepare(
      "SELECT * FROM feed_posts WHERE id=? AND deleted_at IS NULL AND (user_id=? OR visibility='public')",
    )
    .get(id, ctx.session!.userId) as
    | {
        community_id: string | null;
        moderated_at: number | null;
        id: string;
        user_id: string;
        visibility: "private" | "public";
        metadata_enc: string;
        image_enc: string;
        created_at: number;
      }
    | undefined;
  if (
    !r ||
    blocked(ctx, r.user_id) ||
    (r.moderated_at !== null && r.user_id !== ctx.session!.userId) ||
    (r.community_id &&
      (writable || r.user_id !== ctx.session!.userId) &&
      (!membership(ctx, r.community_id)?.active ||
        membership(ctx, r.community_id)?.restricted))
  )
    throw new HttpError(404, "not_found", "Post unavailable.");
  return r;
}
export function socialCounts(ctx: Ctx, id: string) {
  const owner = ctx.session!.userId;
  const rows = ctx.deps.db
    .prepare(
      "SELECT r.kind,COUNT(*) AS n FROM post_reactions r WHERE post_id=? AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.user_id=? AND b.target_id=r.user_id) OR (b.user_id=r.user_id AND b.target_id=?)) GROUP BY kind",
    )
    .all(id, owner, owner) as { kind: string; n: number }[];
  const mine = ctx.deps.db
    .prepare("SELECT kind FROM post_reactions WHERE post_id=? AND user_id=?")
    .get(id, owner) as { kind: string } | undefined;
  const count = ctx.deps.db
    .prepare(
      "SELECT COUNT(*) AS n FROM post_comments c WHERE post_id=? AND deleted_at IS NULL AND moderated_at IS NULL AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.user_id=? AND b.target_id=c.user_id) OR (b.user_id=c.user_id AND b.target_id=?))",
    )
    .get(id, owner, owner) as { n: number };
  return {
    reactions: {
      counts: Object.fromEntries(rows.map((r) => [r.kind, r.n])),
      mine: mine?.kind ?? null,
    },
    commentCount: count.n,
  };
}
export function following(ctx: Ctx, id: string) {
  return !!ctx.deps.db
    .prepare("SELECT 1 FROM user_follows WHERE user_id=? AND target_id=?")
    .get(ctx.session!.userId, id);
}
