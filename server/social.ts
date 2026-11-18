import { randomUUID } from "node:crypto";
import { encrypt, decrypt } from "./crypto";
import { HttpError, sendJson, type Ctx, type Route } from "./http";
import {
  accessiblePost,
  blocked,
  following,
  member,
  publicIdentity,
} from "./social-core";
import { postView } from "./posts";
import { limit } from "./limits";
import { loadCabinet, saveCabinet } from "./achievements";
import { applyEvent } from "../src/achievements/events";

function key(ctx: Ctx) {
  if (!ctx.deps.tokenKey)
    throw new HttpError(
      503,
      "unavailable",
      "Protected social storage unavailable.",
    );
  return ctx.deps.tokenKey;
}
function transaction<T>(ctx: Ctx, fn: () => T): T {
  ctx.deps.db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    ctx.deps.db.exec("COMMIT");
    return result;
  } catch (e) {
    ctx.deps.db.exec("ROLLBACK");
    throw e;
  }
}
async function body(ctx: Ctx) {
  limit(ctx.deps, ctx.req, "social-write", 120, 60000);
  const b = (await ctx.readJson()) as Record<string, unknown>;
  if (
    !b ||
    typeof b !== "object" ||
    typeof b.id !== "string" ||
    b.id.length > 150
  )
    throw new HttpError(400, "invalid_social", "Choose a post or member.");
  return b;
}
function notify(ctx: Ctx, recipient: string, kind: string, subject: string) {
  if (recipient === ctx.session!.userId) return;
  // A durable receipt prevents remove/re-add spam from generating another alert.
  ctx.deps.db
    .prepare(
      "INSERT INTO social_notifications(recipient_id,actor_id,kind,subject_id,created_at) VALUES(?,?,?,?,?) ON CONFLICT " +
        (kind === "comment"
          ? "DO UPDATE SET created_at=excluded.created_at,seen=0"
          : "DO NOTHING"),
    )
    .run(recipient, ctx.session!.userId, kind, subject, ctx.deps.now());
}
function supportAward(ctx: Ctx, eventId: string) {
  const before = loadCabinet(ctx),
    next = applyEvent(
      before,
      { kind: "support_given", id: eventId },
      ctx.session!.userId,
      ctx.deps.now(),
    );
  saveCabinet(ctx, next);
  return next.awards
    .filter((a) => !before.awards.some((b) => b.id === a.id))
    .map((a) => a.id);
}
type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  text_enc: string;
  created_at: number;
  deleted_at: number | null;
};
function comments(ctx: Ctx, id: string) {
  accessiblePost(ctx, id);
  const rows = ctx.deps.db
    .prepare(
      "SELECT * FROM post_comments WHERE post_id=? AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 100",
    )
    .all(id) as CommentRow[];
  return rows
    .filter((r) => !blocked(ctx, r.user_id))
    .reverse()
    .map((r) => ({
      id: r.id,
      authorId: r.user_id,
      authorProfile: publicIdentity(ctx, r.user_id),
      owned: r.user_id === ctx.session!.userId,
      text: decrypt(r.text_enc, key(ctx), `comment:v1:${r.user_id}:${r.id}`),
      createdAt: r.created_at,
    }));
}
function relationship(ctx: Ctx, id: string) {
  member(ctx, id);
  const count = (column: string, other: string) =>
    (
      ctx.deps.db
        .prepare(
          `SELECT COUNT(*) AS n FROM user_follows f WHERE ${column}=? AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.user_id=? AND b.target_id=f.${other}) OR (b.user_id=f.${other} AND b.target_id=?))`,
        )
        .get(id, ctx.session!.userId, ctx.session!.userId) as { n: number }
    ).n;
  return {
    id,
    owned: id === ctx.session!.userId,
    following: following(ctx, id),
    followers: count("target_id", "user_id"),
    followingCount: count("user_id", "target_id"),
  };
}
export const socialRoutes: Route[] = [
  {
    method: "POST",
    path: "/api/social/boost",
    handler: async (ctx) => {
      const b = await body(ctx);
      if (typeof b.active !== "boolean")
        throw new HttpError(400, "invalid_social", "Choose whether to Boost.");
      const result = transaction(ctx, () => {
        const p = accessiblePost(ctx, b.id as string),
          owner = ctx.session!.userId;
        if (p.user_id === owner)
          throw new HttpError(
            400,
            "own_post",
            "You cannot Boost your own post.",
          );
        let unlockedIds: string[] = [];
        if (b.active) {
          const added = ctx.deps.db
            .prepare(
              "INSERT INTO post_reactions(post_id,user_id,kind,created_at) VALUES(?,?,'boost',?) ON CONFLICT DO NOTHING",
            )
            .run(p.id, owner, ctx.deps.now());
          if (added.changes) {
            notify(ctx, p.user_id, "boost", p.id);
            unlockedIds = supportAward(ctx, `boost:${p.id}`);
          }
        } else
          ctx.deps.db
            .prepare("DELETE FROM post_reactions WHERE post_id=? AND user_id=?")
            .run(p.id, owner);
        return { post: postView(ctx, p), unlockedIds };
      });
      sendJson(ctx.res, 200, result);
    },
  },
  {
    method: "GET",
    path: "/api/social/comments",
    handler: (ctx) =>
      sendJson(ctx.res, 200, {
        comments: comments(ctx, ctx.url.searchParams.get("id") ?? ""),
      }),
  },
  {
    method: "POST",
    path: "/api/social/comments",
    handler: async (ctx) => {
      const b = await body(ctx);
      key(ctx);
      if (
        typeof b.text !== "string" ||
        !b.text.trim() ||
        b.text.length > 1000 ||
        typeof b.requestId !== "string" ||
        !/^[\w-]{16,100}$/.test(b.requestId)
      )
        throw new HttpError(
          400,
          "invalid_comment",
          "Use a comment of 1–1000 characters.",
        );
      const result = transaction(ctx, () => {
        const p = accessiblePost(ctx, b.id as string),
          owner = ctx.session!.userId,
          text = (b.text as string).trim();
        const existing = ctx.deps.db
          .prepare(
            "SELECT * FROM post_comments WHERE user_id=? AND request_key=?",
          )
          .get(owner, b.requestId as string) as CommentRow | undefined;
        if (existing) {
          if (
            existing.deleted_at !== null ||
            existing.post_id !== p.id ||
            decrypt(
              existing.text_enc,
              key(ctx),
              `comment:v1:${owner}:${existing.id}`,
            ) !== text
          )
            throw new HttpError(
              409,
              "comment_conflict",
              "This comment request was already used.",
            );
        } else {
          const id = randomUUID();
          ctx.deps.db
            .prepare(
              "INSERT INTO post_comments(id,post_id,user_id,request_key,text_enc,created_at) VALUES(?,?,?,?,?,?)",
            )
            .run(
              id,
              p.id,
              owner,
              b.requestId as string,
              encrypt(text, key(ctx), `comment:v1:${owner}:${id}`),
              ctx.deps.now(),
            );
          notify(ctx, p.user_id, "comment", p.id);
        }
        return { post: postView(ctx, p), comments: comments(ctx, p.id) };
      });
      sendJson(ctx.res, 200, result);
    },
  },
  {
    method: "POST",
    path: "/api/social/comments/delete",
    handler: async (ctx) => {
      const b = await body(ctx);
      transaction(ctx, () => {
        const row = ctx.deps.db
          .prepare("SELECT * FROM post_comments WHERE id=? AND user_id=?")
          .get(b.id as string, ctx.session!.userId) as CommentRow | undefined;
        if (!row) throw new HttpError(404, "not_found", "Comment unavailable.");
        // Deletion of one's own content remains possible even after being blocked.
        ctx.deps.db
          .prepare(
            "UPDATE post_comments SET text_enc='',deleted_at=COALESCE(deleted_at,?) WHERE id=?",
          )
          .run(ctx.deps.now(), row.id);
      });
      sendJson(ctx.res, 200, { deleted: true });
    },
  },
  {
    method: "GET",
    path: "/api/social/member",
    handler: (ctx) =>
      sendJson(
        ctx.res,
        200,
        relationship(
          ctx,
          ctx.url.searchParams.get("id") ?? ctx.session!.userId,
        ),
      ),
  },
  {
    method: "POST",
    path: "/api/social/follow",
    handler: async (ctx) => {
      const b = await body(ctx);
      if (typeof b.active !== "boolean")
        throw new HttpError(
          400,
          "invalid_social",
          "Choose a follow preference.",
        );
      const result = transaction(ctx, () => {
        const id = b.id as string;
        member(ctx, id);
        if (id === ctx.session!.userId)
          throw new HttpError(400, "own_profile", "Choose another member.");
        if (b.active) {
          ctx.deps.db
            .prepare(
              "INSERT INTO user_follows VALUES(?,?) ON CONFLICT DO NOTHING",
            )
            .run(ctx.session!.userId, id);
          notify(ctx, id, "follow", id);
        } else
          ctx.deps.db
            .prepare("DELETE FROM user_follows WHERE user_id=? AND target_id=?")
            .run(ctx.session!.userId, id);
        return relationship(ctx, id);
      });
      sendJson(ctx.res, 200, result);
    },
  },
  {
    method: "GET",
    path: "/api/social/blocks",
    handler: (ctx) => {
      const rows = ctx.deps.db
        .prepare("SELECT target_id FROM user_blocks WHERE user_id=?")
        .all(ctx.session!.userId) as { target_id: string }[];
      sendJson(ctx.res, 200, {
        blocks: rows.map((r) => ({
          id: r.target_id,
          profile: publicIdentity(ctx, r.target_id),
        })),
      });
    },
  },
  {
    method: "POST",
    path: "/api/social/block",
    handler: async (ctx) => {
      const b = await body(ctx);
      if (typeof b.active !== "boolean" || b.id === ctx.session!.userId)
        throw new HttpError(
          400,
          "invalid_social",
          "Choose a block preference.",
        );
      transaction(ctx, () => {
        const id = b.id as string;
        if (!ctx.deps.db.prepare("SELECT 1 FROM users WHERE id=?").get(id))
          throw new HttpError(404, "not_found", "Member unavailable.");
        if (b.active) {
          ctx.deps.db
            .prepare(
              "INSERT INTO user_blocks VALUES(?,?) ON CONFLICT DO NOTHING",
            )
            .run(ctx.session!.userId, id);
          ctx.deps.db
            .prepare(
              "DELETE FROM user_follows WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)",
            )
            .run(ctx.session!.userId, id, id, ctx.session!.userId);
          ctx.deps.db
            .prepare(
              "DELETE FROM post_reactions WHERE (user_id=? AND post_id IN (SELECT id FROM feed_posts WHERE user_id=?)) OR (user_id=? AND post_id IN (SELECT id FROM feed_posts WHERE user_id=?))",
            )
            .run(ctx.session!.userId, id, id, ctx.session!.userId);
        } else
          ctx.deps.db
            .prepare("DELETE FROM user_blocks WHERE user_id=? AND target_id=?")
            .run(ctx.session!.userId, id);
      });
      sendJson(ctx.res, 200, { blocked: b.active });
    },
  },
  {
    method: "GET",
    path: "/api/social/notifications",
    handler: (ctx) => {
      const rows = ctx.deps.db
        .prepare(
          "SELECT * FROM social_notifications WHERE recipient_id=? ORDER BY created_at DESC LIMIT 100",
        )
        .all(ctx.session!.userId) as {
        actor_id: string;
        kind: "boost" | "comment" | "follow";
        subject_id: string;
        created_at: number;
        seen: number;
      }[];
      const notifications = rows
        .filter((r) => {
          if (blocked(ctx, r.actor_id)) return false;
          if (r.kind === "follow")
            return !!ctx.deps.db
              .prepare(
                "SELECT 1 FROM user_follows WHERE user_id=? AND target_id=?",
              )
              .get(r.actor_id, ctx.session!.userId);
          try {
            accessiblePost(ctx, r.subject_id);
          } catch {
            return false;
          }
          return !!ctx.deps.db
            .prepare(
              r.kind === "boost"
                ? "SELECT 1 FROM post_reactions WHERE post_id=? AND user_id=?"
                : "SELECT 1 FROM post_comments WHERE post_id=? AND user_id=? AND deleted_at IS NULL",
            )
            .get(r.subject_id, r.actor_id);
        })
        .map((r) => ({
          actorId: r.actor_id,
          actor: ((p) => ({ name: p.name, username: p.username }))(
            publicIdentity(ctx, r.actor_id),
          ),
          kind: r.kind,
          postId: r.kind === "follow" ? undefined : r.subject_id,
          createdAt: r.created_at,
          seen: !!r.seen,
        }));
      sendJson(ctx.res, 200, { notifications });
    },
  },
  {
    method: "POST",
    path: "/api/social/notifications/read",
    handler: (ctx) => {
      ctx.deps.db
        .prepare("UPDATE social_notifications SET seen=1 WHERE recipient_id=?")
        .run(ctx.session!.userId);
      sendJson(ctx.res, 200, { read: true });
    },
  },
];
