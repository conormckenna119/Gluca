import { blocked } from "./social-core";
import { encrypt, decrypt } from "./crypto";
import { HttpError, sendJson, type Ctx, type Route } from "./http";
import {
  isValidPartialDate,
  sanitizeProfile,
  sanitizePrivacy,
  defaultProfile,
  defaultPrivacy,
} from "../src/domain/profile";
import { publicView } from "../src/domain/public-view";
import { localToday, completedYears } from "../src/domain/shield";
import { limit } from "./limits";
import { loadCabinet } from "./achievements";
import { publicMedal } from "../src/achievements/engine";
import { getDef } from "../src/achievements/registry";
type Row = { payload_enc: string; revision: number };
function key(ctx: Ctx) {
  if (!ctx.deps.tokenKey)
    throw new HttpError(
      503,
      "profile_unavailable",
      "Protected profile storage is unavailable.",
    );
  return ctx.deps.tokenKey;
}
function own(ctx: Ctx) {
  const k = key(ctx),
    owner = ctx.session!.userId;
  const r = ctx.deps.db
    .prepare("SELECT payload_enc,revision FROM user_profiles WHERE user_id=?")
    .get(owner) as Row | undefined;
  if (!r)
    return {
      profile: defaultProfile(),
      privacy: defaultPrivacy(),
      revision: 0,
    };
  const data = JSON.parse(decrypt(r.payload_enc, k, `profile:v1:${owner}`));
  return {
    profile: sanitizeProfile(data.profile),
    privacy: sanitizePrivacy(data.privacy),
    revision: r.revision,
  };
}
async function save(ctx: Ctx) {
  limit(ctx.deps, ctx.req, "profile-save", 60);
  const k = key(ctx),
    body = (await ctx.readJson()) as Record<string, unknown> | null;
  if (
    !body ||
    Array.isArray(body) ||
    !body.profile ||
    typeof body.profile !== "object" ||
    Array.isArray(body.profile) ||
    !body.privacy ||
    typeof body.privacy !== "object" ||
    Array.isArray(body.privacy) ||
    !Number.isSafeInteger(body.revision) ||
    Number(body.revision) < 0
  )
    throw new HttpError(400, "invalid_profile", "Check the profile fields.");
  const raw = body.profile as Record<string, unknown>,
    profile = sanitizeProfile(raw),
    privacy = sanitizePrivacy(body.privacy);
  if (raw.diagnosis && !isValidPartialDate(raw.diagnosis))
    throw new HttpError(400, "invalid_profile", "Check the diagnosis date.");
  if (raw.username && !profile.username)
    throw new HttpError(
      400,
      "invalid_profile",
      "Use a 3–30 character public username: letters, numbers, dot, dash or underscore.",
    );
  if (raw.photo && !profile.photo)
    throw new HttpError(
      400,
      "invalid_profile",
      "Choose a smaller JPEG or PNG photo.",
    );
  if (
    profile.diagnosis &&
    !completedYears(profile.diagnosis, localToday(new Date(ctx.deps.now())))
  )
    throw new HttpError(
      400,
      "invalid_profile",
      "Diagnosis cannot be in the future.",
    );
  const owner = ctx.session!.userId,
    revision = Number(body.revision);
  ctx.deps.db.exec("BEGIN IMMEDIATE");
  try {
    const current = ctx.deps.db
      .prepare("SELECT revision FROM user_profiles WHERE user_id=?")
      .get(owner) as { revision: number } | undefined;
    if ((current?.revision ?? 0) !== revision)
      throw new HttpError(
        409,
        "profile_conflict",
        "This profile changed in another session. Reload before saving.",
      );
    if (
      profile.username &&
      ctx.deps.db
        .prepare("SELECT 1 FROM user_profiles WHERE handle=? AND user_id<>?")
        .get(profile.username, owner)
    )
      throw new HttpError(
        409,
        "handle_unavailable",
        "That public username is unavailable.",
      );
    const encrypted = encrypt(
      JSON.stringify({ profile, privacy }),
      k,
      `profile:v1:${owner}`,
    );
    ctx.deps.db
      .prepare(
        "INSERT INTO user_profiles(user_id,handle,payload_enc,revision,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,payload_enc=excluded.payload_enc,revision=excluded.revision,updated_at=excluded.updated_at",
      )
      .run(
        owner,
        profile.username ?? null,
        encrypted,
        revision + 1,
        ctx.deps.now(),
      );
    ctx.deps.db.exec("COMMIT");
  } catch (e) {
    ctx.deps.db.exec("ROLLBACK");
    throw e;
  }
  sendJson(ctx.res, 200, { profile, privacy, revision: revision + 1 });
}
function publicProfile(ctx: Ctx) {
  limit(ctx.deps, ctx.req, "profile-public", 120);
  const handle = ctx.url.searchParams.get("username") ?? "";
  if (!/^[a-z0-9_.-]{3,30}$/.test(handle))
    throw new HttpError(400, "invalid_profile", "Choose a public username.");
  const r = ctx.deps.db
    .prepare("SELECT user_id,payload_enc FROM user_profiles WHERE handle=?")
    .get(handle) as { user_id: string; payload_enc: string } | undefined;
  if (!r || blocked(ctx, r.user_id))
    throw new HttpError(404, "not_found", "Profile not found.");
  const p = JSON.parse(
    decrypt(r.payload_enc, key(ctx), `profile:v1:${r.user_id}`),
  );
  const cabinet = loadCabinet(ctx, r.user_id);
  const medals = cabinet.public
    ? cabinet.awards
        .filter(
          (a) =>
            a.visibility === "public" &&
            !a.withdrawn &&
            getDef(a.achievementId)?.category !== "health",
        )
        .flatMap((a) => {
          const def = getDef(a.achievementId);
          return def ? [{ ...publicMedal(a, def), pinned: a.pinned }] : [];
        })
    : [];
  sendJson(ctx.res, 200, {
    accountId: r.user_id,
    ...publicView(sanitizeProfile(p.profile), sanitizePrivacy(p.privacy), {
      today: localToday(new Date(ctx.deps.now())),
      clubs: [],
      clubVisibility: {},
      awards: [],
    }),
    ...(cabinet.public ? { medals } : {}),
  });
}
export const profileRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/profile",
    handler: (ctx) => sendJson(ctx.res, 200, own(ctx)),
  },
  { method: "POST", path: "/api/profile", handler: save },
  { method: "GET", path: "/api/profiles/public", handler: publicProfile },
];
