import { HttpError, redirect, sendJson, type Ctx, type Route } from "./http";
import { sessionRoutes } from "./session";
import {
  buildAuthorizeUrl,
  consumeState,
  createState,
  exchangeCode,
  storeConnection,
} from "./dexcom/oauth";
import { ensureFreshConnection, loadConnection } from "./dexcom/client";
import { RateLimited, ReconnectRequired, Unavailable } from "./dexcom/errors";
import { limit } from "./limits";
import { availableRangeRoute, readingsRoute } from "./dexcom/relay";
import { connectionStatus } from "./dexcom/status";
function requireMode(ctx: Ctx) {
  if (ctx.deps.mode !== "dexcom")
    throw new HttpError(
      503,
      "dexcom_not_configured",
      "Dexcom sandbox OAuth is not configured on this server.",
    );
}
function back(ctx: Ctx, outcome: "connected" | "denied" | "error") {
  redirect(ctx.res, `${ctx.deps.config.appBaseUrl}/settings?dexcom=${outcome}`);
}
function connect(ctx: Ctx) {
  requireMode(ctx);
  limit(ctx.deps, ctx.req, "connect", 20);
  sendJson(ctx.res, 200, {
    authorizationUrl: buildAuthorizeUrl(
      ctx.deps.config,
      createState(ctx.deps, ctx.session!.idHash),
    ),
  });
}
async function callback(ctx: Ctx) {
  requireMode(ctx);
  limit(ctx.deps, ctx.req, "callback", 60);
  const { url, deps, session } = ctx;
  if (!session) return back(ctx, "error");
  const state = url.searchParams.get("state") ?? "";
  const owner = consumeState(deps, state, session.idHash);
  if (!owner) return back(ctx, "error");
  if (
    url.searchParams.getAll("state").length !== 1 ||
    url.searchParams.getAll("code").length > 1 ||
    url.searchParams.getAll("error").length > 1
  )
    return back(ctx, "error");
  if (url.searchParams.has("error"))
    return back(
      ctx,
      url.searchParams.get("error") === "access_denied" &&
        !url.searchParams.has("code")
        ? "denied"
        : "error",
    );
  const code = url.searchParams.get("code") ?? "";
  if (!code || code.length > 4096) return back(ctx, "error");
  const tokens = await exchangeCode(deps, code);
  if (!tokens) return back(ctx, "error");
  try {
    if (!storeConnection(deps, owner, tokens)) return back(ctx, "error");
  } catch {
    return back(ctx, "error");
  }
  // Stage 2 stops at authorization: no EGV/dataRange fetch or history persistence.
  back(ctx, "connected");
}
async function status(ctx: Ctx) {
  limit(ctx.deps, ctx.req, "status", 180);
  sendJson(ctx.res, 200, await connectionStatus(ctx.deps, ctx.session!));
}
async function refresh(ctx: Ctx) {
  requireMode(ctx);
  limit(ctx.deps, ctx.req, "refresh", 12);
  try {
    await ensureFreshConnection(ctx.deps, ctx.session!.userId, true);
    sendJson(ctx.res, 200, { refreshed: true });
  } catch (e) {
    if (e instanceof RateLimited) {
      ctx.res.setHeader("Retry-After", String(e.retryAfterSeconds));
      throw new HttpError(429, "rate_limited", "Try again later.");
    }
    if (e instanceof ReconnectRequired)
      throw new HttpError(
        409,
        "needs_reconnect",
        "Reconnect Dexcom to continue.",
      );
    if (e instanceof Unavailable)
      throw new HttpError(
        503,
        "unavailable",
        "A token refresh is already in progress.",
      );
    throw e;
  }
}
function disconnect(ctx: Ctx) {
  limit(ctx.deps, ctx.req, "disconnect", 20);
  const { deps, session } = ctx;
  deps.db.exec("BEGIN IMMEDIATE");
  try {
    deps.db
      .prepare("UPDATE users SET oauth_epoch=oauth_epoch+1 WHERE id=?")
      .run(session!.userId);
    deps.db
      .prepare(
        "DELETE FROM oauth_states WHERE session_id_hash IN (SELECT id_hash FROM sessions WHERE user_id=?)",
      )
      .run(session!.userId);
    deps.db
      .prepare("DELETE FROM dexcom_connections WHERE user_id=?")
      .run(session!.userId);
    deps.db.exec("COMMIT");
  } catch (e) {
    deps.db.exec("ROLLBACK");
    throw e;
  }
  sendJson(ctx.res, 200, { disconnected: true, revokeAtDexcom: true });
}
function later(): never {
  throw new HttpError(
    501,
    "stage_not_enabled",
    "Glucose data retrieval is not enabled in Stage 2.",
  );
}
export const routes: Route[] = [
  {
    method: "GET",
    path: "/api/health",
    session: false,
    handler: ({ deps, res }) =>
      sendJson(res, 200, { ok: true, mode: deps.mode }),
  },
  ...sessionRoutes,
  { method: "POST", path: "/api/dexcom/connect", handler: connect },
  {
    method: "GET",
    path: "/api/dexcom/callback",
    session: false,
    handler: callback,
  },
  { method: "GET", path: "/api/dexcom/status", handler: status },
  { method: "POST", path: "/api/dexcom/refresh", handler: refresh },
  { method: "POST", path: "/api/dexcom/disconnect", handler: disconnect },
  {
    method: "GET",
    path: "/api/dexcom/data-range",
    handler: availableRangeRoute,
  },
  { method: "POST", path: "/api/dexcom/egvs", handler: readingsRoute },
  { method: "POST", path: "/api/dexcom/sync", handler: later },
  { method: "GET", path: "/api/glucose", handler: later },
  { method: "POST", path: "/api/dexcom/delete-data", handler: later },
];
