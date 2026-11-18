import { randomUUID } from "node:crypto";
import { encrypt, decrypt } from "./crypto";
import { HttpError, sendJson, type Ctx, type Route } from "./http";
import { limit } from "./limits";
import {
  CHALLENGES,
  getChallenge,
  challengeAvailable,
  enroll,
  leaveParticipation,
  type Participation,
  type Challenge,
} from "../src/achievements/challenges";
import { applyEvent, type AchievementEvent } from "../src/achievements/events";
import { loadCabinet, saveCabinet } from "./achievements";
function key(ctx: Ctx) {
  if (!ctx.deps.tokenKey)
    throw new HttpError(
      503,
      "unavailable",
      "Protected participation storage unavailable.",
    );
  return ctx.deps.tokenKey;
}
function own(ctx: Ctx, id: string): Participation | undefined {
  const owner = ctx.session!.userId,
    r = ctx.deps.db
      .prepare(
        "SELECT payload_enc FROM challenge_participation WHERE user_id=? AND challenge_id=?",
      )
      .get(owner, id) as { payload_enc: string } | undefined;
  return r
    ? JSON.parse(
        decrypt(r.payload_enc, key(ctx), `challenge:v1:${owner}:${id}`),
      )
    : undefined;
}
function save(ctx: Ctx, p: Participation) {
  const owner = ctx.session!.userId;
  ctx.deps.db
    .prepare(
      "INSERT INTO challenge_participation(user_id,challenge_id,payload_enc) VALUES(?,?,?) ON CONFLICT(user_id,challenge_id) DO UPDATE SET payload_enc=excluded.payload_enc",
    )
    .run(
      owner,
      p.challengeId,
      encrypt(
        JSON.stringify(p),
        key(ctx),
        `challenge:v1:${owner}:${p.challengeId}`,
      ),
    );
}
function list(ctx: Ctx) {
  key(ctx);
  return CHALLENGES.flatMap((c) => {
    const p = own(ctx, c.id);
    return p ? [p] : [];
  });
}
function complete(
  ctx: Ctx,
  c: Challenge,
  p: Participation,
  source: NonNullable<Participation["source"]>,
  sourceId: string,
  communityId?: string,
) {
  if (p.status === "completed")
    return { participation: p, unlockedIds: [] as string[] };
  if (
    p.status !== "joined" ||
    !challengeAvailable(c, ctx.deps.now()) ||
    p.ruleVersion !== c.ruleVersion
  )
    throw new HttpError(
      409,
      "challenge_changed",
      "Join an available challenge before completing it.",
    );
  const kinds: Record<Challenge["criterion"], AchievementEvent["kind"]> = {
    public_post: "post_published",
    activity: "activity_logged",
    awareness: "awareness_confirmed",
    connection: "connection_confirmed",
    milestone: "milestone_confirmed",
  };
  const before = loadCabinet(ctx),
    next = applyEvent(
      before,
      { id: sourceId, kind: kinds[c.criterion] },
      ctx.session!.userId,
      ctx.deps.now(),
    );
  const award = next.awards.find(
    (a) => a.achievementId === c.medalId && !a.withdrawn,
  );
  const participation: Participation = {
    ...p,
    status: "completed",
    completedAt: ctx.deps.now(),
    source,
    sourceId,
    ...(communityId ? { communityId } : {}),
    ...(award ? { awardId: award.id } : {}),
  };
  saveCabinet(ctx, next);
  save(ctx, participation);
  return {
    participation,
    unlockedIds: next.awards
      .filter((a) => !before.awards.some((b) => b.id === a.id))
      .map((a) => a.id),
  };
}
/** Called only inside the existing NEW public-post transaction; no history scans or replay backfill. */
export function completeChallengeForPost(ctx: Ctx, postId: string) {
  const c = getChallenge("share_moment")!,
    p = own(ctx, c.id);
  if (
    !p ||
    p.status !== "joined" ||
    !challengeAvailable(c, ctx.deps.now()) ||
    p.ruleVersion !== c.ruleVersion
  )
    return;
  if (
    !ctx.deps.db
      .prepare(
        "SELECT 1 FROM feed_posts WHERE id=? AND user_id=? AND visibility='public' AND community_id IS NULL AND moderated_at IS NULL AND deleted_at IS NULL",
      )
      .get(postId, ctx.session!.userId)
  )
    return;
  complete(ctx, c, p, "verified_post", postId);
}
async function mutate(ctx: Ctx) {
  limit(ctx.deps, ctx.req, "challenge-write", 90);
  key(ctx);
  const b = (await ctx.readJson()) as Record<string, unknown> | null;
  const c =
    b && typeof b.challengeId === "string"
      ? getChallenge(b.challengeId)
      : undefined;
  if (
    !b ||
    !c ||
    !["join", "leave", "complete"].includes(String(b.action)) ||
    (b.visibility !== undefined && b.visibility !== "private")
  )
    throw new HttpError(
      400,
      "unsupported_challenge",
      "Choose a supported private challenge action.",
    );
  let unlockedIds: string[] = [];
  ctx.deps.db.exec("BEGIN IMMEDIATE");
  try {
    const p = own(ctx, c.id),
      now = ctx.deps.now();
    if (b.action === "join") {
      try {
        save(ctx, enroll(c, p, now, randomUUID()));
      } catch {
        throw new HttpError(
          409,
          "unavailable_challenge",
          "This challenge is not currently available.",
        );
      }
    } else {
      if (
        !p ||
        typeof b.enrollmentId !== "string" ||
        b.enrollmentId !== p.enrollmentId
      )
        throw new HttpError(
          409,
          "enrollment_changed",
          "Reload your enrollment before continuing.",
        );
      if (b.action === "leave")
        save(ctx, leaveParticipation(p, b.enrollmentId, now));
      else if (p.status !== "completed") {
        if (c.criterion === "public_post")
          throw new HttpError(
            400,
            "post_required",
            "Publish a new Public Gluca post after joining. Exports and private posts do not count.",
          );
        if (b.confirmed !== true)
          throw new HttpError(
            400,
            "confirmation_required",
            "Confirm your own completed action first.",
          );
        if (
          c.criterion === "connection" &&
          (b.communityId !== "outside_gluca" ||
            b.joinedCommunity !== true ||
            b.meaningfulInteraction !== true)
        )
          throw new HttpError(
            400,
            "community_required",
            "Confirm joining an existing community outside Gluca and taking part in a meaningful exchange.",
          );
        if (b.source !== undefined && b.source !== "activity_log")
          throw new HttpError(
            400,
            "unsupported_source",
            "Unsupported completion source.",
          );
        if (b.source === "activity_log" && c.criterion !== "activity")
          throw new HttpError(
            400,
            "unsupported_source",
            "Activity logs apply only to Get Moving.",
          );
        const result = complete(
          ctx,
          c,
          p,
          b.source === "activity_log"
            ? "self_reported_activity_log"
            : "self_reported",
          `challenge:${p.enrollmentId}`,
          c.criterion === "connection" ? String(b.communityId) : undefined,
        );
        unlockedIds = result.unlockedIds;
      }
    }
    ctx.deps.db.exec("COMMIT");
  } catch (e) {
    ctx.deps.db.exec("ROLLBACK");
    throw e;
  }
  sendJson(ctx.res, 200, { participations: list(ctx), unlockedIds });
}
export const challengeRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/challenges",
    handler: (ctx) =>
      sendJson(ctx.res, 200, { participations: list(ctx), unlockedIds: [] }),
  },
  { method: "POST", path: "/api/challenges", handler: mutate },
];
