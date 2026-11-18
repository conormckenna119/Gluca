import {
  requireCommunityMember,
  communityDefinition,
  membership,
} from "./community-access";
import { getCommunity } from "../src/domain/community-discovery";
import {
  accessiblePost,
  blocked,
  publicIdentity,
  socialCounts,
  following,
} from "./social-core";
import { randomUUID } from "node:crypto";
import { encrypt, decrypt, sha256hex } from "./crypto";
import { type Ctx, type Route, HttpError, sendJson } from "./http";
import { exportedPng } from "./post-image";
import { limit } from "./limits";
import { loadCabinet } from "./achievements";
import { completeChallengeForPost } from "./challenges";
import { applyEvent } from "../src/achievements/events";
type Row = {
  community_id?: string | null;
  moderated_at?: number | null;
  deleted_at?: number | null;
  id: string;
  user_id: string;
  visibility: "private" | "public";
  metadata_enc: string;
  image_enc?: string;
  created_at: number;
};
function key(ctx: Ctx) {
  if (!ctx.deps.tokenKey)
    throw new HttpError(
      503,
      "unavailable",
      "Protected image storage unavailable.",
    );
  return ctx.deps.tokenKey;
}
function meta(ctx: Ctx, r: Row) {
  return JSON.parse(
    decrypt(r.metadata_enc, key(ctx), `post:v1:${r.user_id}:${r.id}`),
  );
}
export function postView(ctx: Ctx, r: Row) {
  const m = meta(ctx, r),
    mine = r.user_id === ctx.session!.userId;
  const identity = publicIdentity(ctx, r.user_id);
  return {
    id: r.id,
    author: mine ? "You" : identity.name,
    title: m.title,
    caption: m.caption,
    visibility: r.visibility,
    createdAt: r.created_at,
    remote: true,
    owned: mine,
    moderated: r.moderated_at != null,
    authorProfile: identity,
    authorId: r.user_id,
    ...(r.community_id
      ? {
          communityId: r.community_id,
          communityName: getCommunity(r.community_id)?.name,
        }
      : {}),
    isFollowing: following(ctx, r.user_id),
    ...(m.hasMedia === false
      ? {}
      : {
          media: {
            uri: `/api/posts/image?id=${r.id}`,
            width: m.width,
            height: m.height,
            alt: m.alt,
          },
        }),
    ...(r.community_id &&
    (!membership(ctx, r.community_id)?.active ||
      membership(ctx, r.community_id)?.restricted)
      ? { reactions: { counts: {}, mine: null }, commentCount: 0 }
      : socialCounts(ctx, r.id)),
    saved: false,
    comments: [],
  };
}
async function create(ctx: Ctx) {
  limit(ctx.deps, ctx.req, "post-create", 30);
  key(ctx);
  const b = (await ctx.readJson(13 * 1024 * 1024)) as Record<string, unknown>;
  if (
    !b ||
    typeof b !== "object" ||
    typeof b.requestId !== "string" ||
    !/^[a-zA-Z0-9_-]{16,100}$/.test(b.requestId) ||
    !["private", "public"].includes(String(b.visibility)) ||
    typeof b.caption !== "string" ||
    b.caption.length > 1000 ||
    typeof b.title !== "string" ||
    b.title.length > 100 ||
    typeof b.alt !== "string" ||
    b.alt.length > 2000
  )
    throw new HttpError(
      400,
      "invalid_post",
      "Check caption, description and audience. Followers-only is unavailable.",
    );
  const communityId =
    b.communityId === undefined ? null : communityDefinition(b.communityId).id;
  if (communityId && b.visibility !== "public")
    throw new HttpError(
      400,
      "invalid_audience",
      "Community posts use the community-members audience.",
    );
  const hasMedia = b.image !== undefined;
  if (!hasMedia && (!communityId || !(b.caption as string).trim()))
    throw new HttpError(400, "invalid_post", "Add text or an image.");
  let png: ReturnType<typeof exportedPng> | null = null;
  try {
    if (hasMedia) png = exportedPng(b.image);
  } catch {
    throw new HttpError(
      400,
      "invalid_image",
      "Use a complete 1080px Gluca PNG under 9 MB.",
    );
  }
  const fingerprint = sha256hex(
      JSON.stringify([
        b.image,
        b.caption,
        b.title,
        b.alt,
        b.visibility,
        ...(communityId ? [communityId] : []),
      ]),
    ),
    owner = ctx.session!.userId;
  ctx.deps.db.exec("BEGIN IMMEDIATE");
  let row: Row;
  try {
    if (communityId) requireCommunityMember(ctx, communityId);
    const existing = ctx.deps.db
      .prepare("SELECT * FROM feed_posts WHERE user_id=? AND request_key=?")
      .get(owner, b.requestId) as Row | undefined;
    if (existing) {
      if (existing.deleted_at != null)
        throw new HttpError(409, "post_deleted", "This post was deleted.");
      if (meta(ctx, existing).fingerprint !== fingerprint)
        throw new HttpError(
          409,
          "post_conflict",
          "This export was already submitted with different details.",
        );
      row = existing;
    } else {
      const id = `post-${randomUUID()}`,
        now = ctx.deps.now();
      const metadata = {
        title: b.title,
        caption: b.caption,
        alt: b.alt,
        hasMedia,
        width: png?.width,
        height: png?.height,
        fingerprint,
      };
      ctx.deps.db
        .prepare(
          "INSERT INTO feed_posts(id,user_id,request_key,visibility,metadata_enc,image_enc,created_at,community_id) VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          owner,
          b.requestId,
          b.visibility as string,
          encrypt(JSON.stringify(metadata), key(ctx), `post:v1:${owner}:${id}`),
          png
            ? encrypt(
                png.bytes.toString("base64"),
                key(ctx),
                `post-image:v1:${owner}:${id}`,
              )
            : "",
          now,
          communityId,
        );
      row = {
        id,
        community_id: communityId,
        user_id: owner,
        visibility: b.visibility as "private" | "public",
        metadata_enc: encrypt(
          JSON.stringify(metadata),
          key(ctx),
          `post:v1:${owner}:${id}`,
        ),
        created_at: now,
      };
      if (b.visibility === "public" && !communityId) {
        const cabinet = applyEvent(
          loadCabinet(ctx),
          { kind: "post_published", id },
          owner,
          now,
        );
        ctx.deps.db
          .prepare(
            "INSERT INTO user_achievements(user_id,payload_enc) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET payload_enc=excluded.payload_enc",
          )
          .run(
            owner,
            encrypt(
              JSON.stringify(cabinet),
              key(ctx),
              `achievements:v1:${owner}`,
            ),
          );
      }
    }
    if (!existing && b.visibility === "public" && !communityId)
      completeChallengeForPost(ctx, row.id);
    ctx.deps.db.exec("COMMIT");
  } catch (e) {
    ctx.deps.db.exec("ROLLBACK");
    throw e;
  }
  sendJson(ctx.res, 200, { post: postView(ctx, row) });
}
function accessible(ctx: Ctx) {
  return accessiblePost(ctx, ctx.url.searchParams.get("id") ?? "");
}
export const postRoutes: Route[] = [
  { method: "POST", path: "/api/posts", handler: create },
  {
    method: "GET",
    path: "/api/posts",
    handler: (ctx) => {
      key(ctx);
      if (ctx.url.searchParams.has("id")) {
        sendJson(ctx.res, 200, { post: postView(ctx, accessible(ctx)) });
        return;
      }
      const communityId = ctx.url.searchParams.get("communityId");
      if (communityId) requireCommunityMember(ctx, communityId);
      const rows = ctx.deps.db
        .prepare(
          communityId
            ? "SELECT * FROM feed_posts WHERE community_id=? AND deleted_at IS NULL AND (visibility='public' OR user_id=?) AND (moderated_at IS NULL OR user_id=?) ORDER BY created_at DESC,id DESC LIMIT 30"
            : "SELECT * FROM feed_posts WHERE deleted_at IS NULL AND (user_id=? OR (visibility='public' AND moderated_at IS NULL AND (community_id IS NULL OR EXISTS(SELECT 1 FROM community_memberships m WHERE m.community_id=feed_posts.community_id AND m.user_id=? AND m.active=1 AND m.restricted=0)))) ORDER BY created_at DESC,id DESC LIMIT 30",
        )
        .all(
          ...(communityId
            ? [communityId, ctx.session!.userId, ctx.session!.userId]
            : [ctx.session!.userId, ctx.session!.userId]),
        ) as Row[];
      sendJson(ctx.res, 200, {
        posts: rows
          .filter((r) => !blocked(ctx, r.user_id))
          .map((r) => postView(ctx, r)),
      });
    },
  },
  {
    method: "GET",
    path: "/api/posts/image",
    handler: (ctx) => {
      const r = accessible(ctx);
      if (meta(ctx, r).hasMedia === false)
        throw new HttpError(404, "not_found", "Image unavailable.");
      const bytes = Buffer.from(
        decrypt(r.image_enc!, key(ctx), `post-image:v1:${r.user_id}:${r.id}`),
        "base64",
      );
      ctx.res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": bytes.length,
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'",
        "Cross-Origin-Resource-Policy": "same-origin",
      });
      ctx.res.end(bytes);
    },
  },
  {
    method: "POST",
    path: "/api/posts/delete",
    handler: async (ctx) => {
      const b = (await ctx.readJson()) as { id?: string };
      if (!b || typeof b.id !== "string")
        throw new HttpError(400, "invalid_post", "Choose a post.");
      // Keep the idempotency receipt while erasing image/caption, preventing delayed retries from resurrecting it.
      ctx.deps.db.exec("BEGIN IMMEDIATE");
      try {
        const r = ctx.deps.db
          .prepare(
            "UPDATE feed_posts SET deleted_at=?,metadata_enc='',image_enc='' WHERE id=? AND user_id=? AND deleted_at IS NULL",
          )
          .run(ctx.deps.now(), b.id, ctx.session!.userId);
        if (!r.changes)
          throw new HttpError(404, "not_found", "Post unavailable.");
        ctx.deps.db
          .prepare(
            "UPDATE post_comments SET text_enc='',deleted_at=COALESCE(deleted_at,?) WHERE post_id=?",
          )
          .run(ctx.deps.now(), b.id);
        ctx.deps.db
          .prepare("DELETE FROM post_reactions WHERE post_id=?")
          .run(b.id);
        ctx.deps.db
          .prepare(
            "DELETE FROM social_notifications WHERE subject_id=? AND kind IN ('boost','comment')",
          )
          .run(b.id);
        ctx.deps.db.exec("COMMIT");
      } catch (e) {
        ctx.deps.db.exec("ROLLBACK");
        throw e;
      }
      sendJson(ctx.res, 200, { deleted: true });
    },
  },
];
