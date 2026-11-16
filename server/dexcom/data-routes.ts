// Routes that read or change a user's own Dexcom data. Every query is keyed by the session user;
// there is no parameter by which one user can name another.
import { HttpError, sendJson, type Ctx } from "../http";
import {
  DexcomError,
  Forbidden,
  RateLimited,
  ReconnectRequired,
  Unavailable,
} from "./errors";
import { syncUser, takeForceSlot } from "./sync";

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_READ_WINDOW_MS = 31 * DAY_MS;

function requireDexcomMode(ctx: Ctx): void {
  if (ctx.deps.mode !== "dexcom")
    throw new HttpError(
      503,
      "dexcom_not_configured",
      "Dexcom is not configured on this server (mock mode).",
    );
}

function sendDexcomError(ctx: Ctx, e: unknown): void {
  if (!(e instanceof DexcomError)) throw e;
  if (e instanceof ReconnectRequired)
    return sendJson(ctx.res, 409, { error: "needs_reconnect" });
  if (e instanceof RateLimited)
    return sendJson(ctx.res, 429, {
      error: "rate_limited",
      retryAfterSeconds: e.retryAfterSeconds,
    });
  const status = e instanceof Unavailable ? 503 : 502;
  sendJson(ctx.res, status, {
    error: e instanceof Forbidden ? "forbidden" : e.code,
  });
}

export async function sync(ctx: Ctx): Promise<void> {
  requireDexcomMode(ctx);
  const { deps, session, res } = ctx;
  const wait = takeForceSlot(deps, session!.userId);
  if (wait > 0)
    return sendJson(res, 429, { error: "too_soon", retryAfterSeconds: wait });
  try {
    sendJson(res, 200, await syncUser(deps, session!.userId, { force: true }));
  } catch (e) {
    sendDexcomError(ctx, e);
  }
}

function intParam(ctx: Ctx, name: string): number {
  const raw = ctx.url.searchParams.get(name);
  const n = raw === null || raw.trim() === "" ? NaN : Number(raw);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new HttpError(
      400,
      "bad_range",
      `${name} must be a time in milliseconds.`,
    );
  return n;
}

export function glucose(ctx: Ctx): void {
  const { deps, session, res } = ctx;
  const start = intParam(ctx, "start");
  const end = intParam(ctx, "end");
  if (end <= start || end - start > MAX_READ_WINDOW_MS)
    throw new HttpError(
      400,
      "bad_range",
      "The range must be positive and at most 31 days.",
    );
  const userId = session!.userId;
  const rows = deps.db
    .prepare(
      `SELECT system_time_ms AS t, mgdl, status, trend FROM egvs
       WHERE user_id = ? AND system_time_ms >= ? AND system_time_ms < ? ORDER BY system_time_ms`,
    )
    .all(userId, start, end);
  const conn = deps.db
    .prepare(
      "SELECT environment, last_sync_at, latest_data_at FROM dexcom_connections WHERE user_id = ?",
    )
    .get(userId) as
    | {
        environment: string;
        last_sync_at: number | null;
        latest_data_at: number | null;
      }
    | undefined;
  sendJson(res, 200, {
    readings: rows.map((r) => ({
      t: r.t,
      mgdl: r.mgdl,
      status: r.status,
      trend: r.trend,
    })),
    source: "dexcom",
    environment: conn?.environment ?? deps.config.environment,
    latestDataAt: conn?.latest_data_at ?? null,
    lastSyncAt: conn?.last_sync_at ?? null,
  });
}

export async function disconnect(ctx: Ctx): Promise<void> {
  requireDexcomMode(ctx);
  const { deps, session, res } = ctx;
  const body = (await ctx.readJson()) as { deleteData?: unknown } | null;
  if (
    body === null ||
    typeof body !== "object" ||
    (body.deleteData !== undefined && typeof body.deleteData !== "boolean")
  )
    throw new HttpError(400, "bad_body", "deleteData must be true or false.");
  const deleteData = body.deleteData === true;
  const userId = session!.userId;
  deps.db
    .prepare("DELETE FROM dexcom_connections WHERE user_id = ?")
    .run(userId);
  if (deleteData)
    deps.db.prepare("DELETE FROM egvs WHERE user_id = ?").run(userId);
  // Dexcom documents no revocation endpoint: the person must revoke access in their Dexcom account.
  sendJson(res, 200, {
    disconnected: true,
    revokeAtDexcom: true,
    dataDeleted: deleteData,
  });
}

export function deleteData(ctx: Ctx): void {
  const { deps, session, res } = ctx;
  const r = deps.db
    .prepare("DELETE FROM egvs WHERE user_id = ?")
    .run(session!.userId);
  sendJson(res, 200, { deleted: Number(r.changes) });
}
