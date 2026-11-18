import { encrypt, decrypt } from "./crypto";
import { HttpError, sendJson, type Ctx, type Route } from "./http";
import {
  applyEvent,
  editCabinet,
  emptyCabinet,
  validEvent,
  type Cabinet,
  type CabinetEdit,
} from "../src/achievements/events";
import { sanitizeProfile } from "../src/domain/profile";
import { limit } from "./limits";
export function loadCabinet(ctx: Ctx, owner = ctx.session!.userId): Cabinet {
  if (!ctx.deps.tokenKey)
    throw new HttpError(
      503,
      "unavailable",
      "Protected medal storage unavailable.",
    );
  const row = ctx.deps.db
    .prepare("SELECT payload_enc FROM user_achievements WHERE user_id=?")
    .get(owner) as { payload_enc: string } | undefined;
  return row
    ? JSON.parse(
        decrypt(row.payload_enc, ctx.deps.tokenKey, `achievements:v1:${owner}`),
      )
    : emptyCabinet();
}
async function update(ctx: Ctx) {
  limit(ctx.deps, ctx.req, "achievement-write", 120);
  const b = (await ctx.readJson()) as {
    event?: unknown;
    edit?: CabinetEdit;
  } | null;
  if (!b || typeof b !== "object" || !!b.event === !!b.edit)
    throw new HttpError(
      400,
      "invalid_event",
      "Choose an event or medal preference.",
    );
  const owner = ctx.session!.userId;
  ctx.deps.db.exec("BEGIN IMMEDIATE");
  let next: Cabinet;
  try {
    const current = loadCabinet(ctx);
    if (b.event) {
      if (!validEvent(b.event))
        throw new HttpError(
          400,
          "invalid_event",
          "Unsupported participation event.",
        );
      if (
        b.event.kind === "post_published" &&
        !ctx.deps.db
          .prepare(
            "SELECT 1 FROM feed_posts WHERE id=? AND user_id=? AND visibility='public' AND deleted_at IS NULL",
          )
          .get(b.event.id, owner)
      )
        throw new HttpError(
          400,
          "unverified_post",
          "Publish a public Gluca post before requesting this medal.",
        );
      const row = ctx.deps.db
        .prepare("SELECT payload_enc FROM user_profiles WHERE user_id=?")
        .get(owner) as { payload_enc: string } | undefined;
      const profile = row
        ? sanitizeProfile(
            JSON.parse(
              decrypt(
                row.payload_enc,
                ctx.deps.tokenKey!,
                `profile:v1:${owner}`,
              ),
            ).profile,
          )
        : undefined;
      // No client-supplied user, award, diagnosis, time, visibility or glucose payload is trusted.
      next = applyEvent(
        current,
        { id: b.event.id, kind: b.event.kind },
        owner,
        ctx.deps.now(),
        profile,
      );
    } else {
      try {
        next = editCabinet(current, b.edit!);
      } catch {
        throw new HttpError(
          400,
          "invalid_preference",
          "Award missing, invalid order, or three medals already pinned.",
        );
      }
    }
    ctx.deps.db
      .prepare(
        "INSERT INTO user_achievements(user_id,payload_enc) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET payload_enc=excluded.payload_enc",
      )
      .run(
        owner,
        encrypt(
          JSON.stringify(next),
          ctx.deps.tokenKey!,
          `achievements:v1:${owner}`,
        ),
      );
    ctx.deps.db.exec("COMMIT");
  } catch (e) {
    ctx.deps.db.exec("ROLLBACK");
    throw e;
  }
  sendJson(ctx.res, 200, next);
}
export const achievementRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/achievements",
    handler: (ctx) => sendJson(ctx.res, 200, loadCabinet(ctx)),
  },
  { method: "POST", path: "/api/achievements", handler: update },
];
