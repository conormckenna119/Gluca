import { type Ctx, type Route, HttpError, sendJson } from "./http";
import { COMMUNITY_CATALOGUE } from "../src/domain/community-discovery";
import {
  communityDefinition,
  membership,
  requireCommunityMember,
  sharesMemberships,
} from "./community-access";
import { blocked, publicIdentity, accessiblePost } from "./social-core";
import { limit } from "./limits";
function visibleMembers(ctx: Ctx, id: string) {
  const rows = ctx.deps.db
    .prepare(
      "SELECT user_id FROM community_memberships WHERE community_id=? AND active=1 AND visible=1 AND restricted=0",
    )
    .all(id) as { user_id: string }[];
  return rows.filter(
    (r) => !blocked(ctx, r.user_id) && sharesMemberships(ctx, r.user_id),
  );
}
function view(ctx: Ctx, id: string) {
  const c = communityDefinition(id),
    m = membership(ctx, id);
  return {
    ...c,
    joined: !!m?.active && !m.restricted,
    visible: !!m?.visible,
    restricted: !!m?.restricted,
    memberCount: visibleMembers(ctx, id).length,
  };
}
async function body(ctx: Ctx) {
  limit(ctx.deps, ctx.req, "community-write", 60, 60000);
  const b = (await ctx.readJson()) as Record<string, unknown>;
  if (!b || typeof b !== "object")
    throw new HttpError(400, "invalid_community", "Choose a community action.");
  return b;
}
function transaction<T>(ctx: Ctx, fn: () => T) {
  ctx.deps.db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    ctx.deps.db.exec("COMMIT");
    return r;
  } catch (e) {
    ctx.deps.db.exec("ROLLBACK");
    throw e;
  }
}
export const REPORT_REASONS = [
  "spam",
  "harassment",
  "privacy",
  "unsafe_advice",
  "other",
] as const;
function moderator(ctx: Ctx, id: string) {
  requireCommunityMember(ctx, id);
  if (
    !ctx.deps.db
      .prepare(
        "SELECT 1 FROM community_moderators WHERE community_id=? AND user_id=?",
      )
      .get(id, ctx.session!.userId)
  )
    throw new HttpError(
      403,
      "forbidden",
      "Community moderation is restricted.",
    );
}
export const communityRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/communities",
    handler: (ctx) =>
      sendJson(ctx.res, 200, {
        communities: COMMUNITY_CATALOGUE.map((c) => view(ctx, c.id)),
      }),
  },
  {
    method: "POST",
    path: "/api/communities/membership",
    handler: async (ctx) => {
      const b = await body(ctx),
        c = communityDefinition(b.id),
        owner = ctx.session!.userId;
      if (
        !["join", "leave", "visibility"].includes(String(b.action)) ||
        (b.action === "visibility" && typeof b.visible !== "boolean")
      )
        throw new HttpError(
          400,
          "invalid_community",
          "Choose join, leave or visibility.",
        );
      const result = transaction(ctx, () => {
        const m = membership(ctx, c.id);
        if (b.action === "join") {
          if (m?.restricted)
            throw new HttpError(403, "restricted", "Membership is restricted.");
          // Retry keeps visibility/join date; rejoining after leaving is private again.
          ctx.deps.db
            .prepare(
              "INSERT INTO community_memberships(community_id,user_id,joined_at) VALUES(?,?,?) ON CONFLICT(community_id,user_id) DO UPDATE SET active=1,visible=CASE WHEN active=0 THEN 0 ELSE visible END,joined_at=CASE WHEN active=0 THEN excluded.joined_at ELSE joined_at END WHERE restricted=0",
            )
            .run(c.id, owner, ctx.deps.now());
        } else if (b.action === "leave")
          ctx.deps.db
            .prepare(
              "UPDATE community_memberships SET active=0,visible=0 WHERE community_id=? AND user_id=?",
            )
            .run(c.id, owner);
        else {
          requireCommunityMember(ctx, c.id);
          ctx.deps.db
            .prepare(
              "UPDATE community_memberships SET visible=? WHERE community_id=? AND user_id=?",
            )
            .run(b.visible ? 1 : 0, c.id, owner);
        }
        return view(ctx, c.id);
      });
      sendJson(ctx.res, 200, { community: result });
    },
  },
  {
    method: "GET",
    path: "/api/communities/members",
    handler: (ctx) => {
      const id = ctx.url.searchParams.get("id") ?? "";
      communityDefinition(id);
      const rows = visibleMembers(ctx, id);
      sendJson(ctx.res, 200, {
        memberCount: rows.length,
        members: rows.slice(0, 50).map((r) => {
          const p = publicIdentity(ctx, r.user_id);
          return {
            id: r.user_id,
            profile: {
              name: p.name,
              username: p.username,
              photo: p.photo,
              shield: p.shield,
              emblem: p.emblem,
              pinnedAchievements: [],
            },
          };
        }),
      });
    },
  },
  {
    method: "POST",
    path: "/api/communities/report",
    handler: async (ctx) => {
      const b = await body(ctx);
      if (
        !["post", "comment", "community"].includes(String(b.kind)) ||
        typeof b.id !== "string" ||
        !(REPORT_REASONS as readonly unknown[]).includes(b.reason)
      )
        throw new HttpError(400, "invalid_report", "Choose a report reason.");
      let communityId: string | null = null;
      if (b.kind === "community") communityId = communityDefinition(b.id).id;
      else if (b.kind === "post")
        communityId = accessiblePost(ctx, b.id).community_id;
      else {
        const r = ctx.deps.db
          .prepare(
            "SELECT post_id,user_id FROM post_comments WHERE id=? AND deleted_at IS NULL AND moderated_at IS NULL",
          )
          .get(b.id) as { post_id: string; user_id: string } | undefined;
        if (!r || blocked(ctx, r.user_id))
          throw new HttpError(404, "not_found", "Comment unavailable.");
        communityId = accessiblePost(ctx, r.post_id).community_id;
      }
      ctx.deps.db
        .prepare(
          "INSERT INTO community_reports(reporter_id,kind,target_id,community_id,reason,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING",
        )
        .run(
          ctx.session!.userId,
          b.kind as string,
          b.id,
          communityId,
          b.reason as string,
          ctx.deps.now(),
        );
      sendJson(ctx.res, 200, { received: true });
    },
  },
  {
    method: "GET",
    path: "/api/communities/reports",
    handler: (ctx) => {
      const id = ctx.url.searchParams.get("id") ?? "";
      moderator(ctx, id);
      // No reporter identity, private membership, comment text, post pixels or medical profile.
      const reports = ctx.deps.db
        .prepare(
          "SELECT kind,target_id,reason,created_at FROM community_reports WHERE community_id=? ORDER BY created_at DESC LIMIT 100",
        )
        .all(id);
      sendJson(ctx.res, 200, { reports });
    },
  },
  {
    method: "POST",
    path: "/api/communities/moderate",
    handler: async (ctx) => {
      const b = await body(ctx),
        c = communityDefinition(b.communityId);
      moderator(ctx, c.id);
      if (typeof b.id !== "string")
        throw new HttpError(
          400,
          "invalid_action",
          "Choose a moderation target.",
        );
      transaction(ctx, () => {
        if (b.action === "restrict_member") {
          if (
            ctx.deps.db
              .prepare(
                "SELECT 1 FROM community_moderators WHERE community_id=? AND user_id=?",
              )
              .get(c.id, b.id as string)
          )
            throw new HttpError(
              403,
              "forbidden",
              "Moderator accounts require operator review.",
            );
          if (
            !ctx.deps.db
              .prepare("SELECT 1 FROM users WHERE id=?")
              .get(b.id as string)
          )
            throw new HttpError(404, "not_found", "Account unavailable.");
          // Same result whether or not a private membership existed; no private member directory.
          ctx.deps.db
            .prepare(
              "INSERT INTO community_memberships(community_id,user_id,active,restricted,joined_at) VALUES(?,?,0,1,?) ON CONFLICT(community_id,user_id) DO UPDATE SET active=0,visible=0,restricted=1",
            )
            .run(c.id, b.id as string, ctx.deps.now());
        } else if (b.action === "hide_post") {
          const r = ctx.deps.db
            .prepare(
              "UPDATE feed_posts SET moderated_at=? WHERE id=? AND community_id=? AND deleted_at IS NULL",
            )
            .run(ctx.deps.now(), b.id as string, c.id);
          if (!r.changes)
            throw new HttpError(404, "not_found", "Post unavailable.");
        } else if (b.action === "hide_comment") {
          const r = ctx.deps.db
            .prepare(
              "UPDATE post_comments SET moderated_at=? WHERE id=? AND post_id IN(SELECT id FROM feed_posts WHERE community_id=?) AND deleted_at IS NULL",
            )
            .run(ctx.deps.now(), b.id as string, c.id);
          if (!r.changes)
            throw new HttpError(404, "not_found", "Comment unavailable.");
        } else
          throw new HttpError(
            400,
            "invalid_action",
            "Unsupported moderation action.",
          );
      });
      sendJson(ctx.res, 200, { updated: true });
    },
  },
];
