// Authenticated transient reads only: never use the historical server EGV repository.
import type { AppDeps, Ctx } from "../http";
import { HttpError, sendJson } from "../http";
import { findSession } from "../session";
import { limit } from "../limits";
import { dexcomFetch, loadConnection } from "./client";
import { normalizeEgvs, parseSystemTime, toReading } from "./normalize";
import {
  DexcomError,
  Forbidden,
  RateLimited,
  ReconnectRequired,
  Unavailable,
  UnexpectedSchema,
} from "./errors";
import {
  intersectWindow,
  validWindow,
  type GlucoseWindow,
  type AvailableGlucoseRange,
  type DexcomDataResult,
} from "../../src/glucose-window";
export function requireDiagnostics(ctx: Ctx) {
  if (
    !ctx.deps.config.diagnosticsEnabled ||
    ctx.deps.config.nodeEnvironment === "production"
  )
    throw new HttpError(404, "not_found", "No such route.");
  if (ctx.deps.mode !== "dexcom")
    throw new HttpError(
      503,
      "dexcom_not_configured",
      "Configure sandbox OAuth before retrieving data.",
    );
}
function envelope(body: unknown, kind: string): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new UnexpectedSchema();
  const b = body as Record<string, unknown>;
  if (
    b.recordType !== kind ||
    b.recordVersion !== "3.0" ||
    typeof b.userId !== "string" ||
    !b.userId ||
    b.userId.length > 256
  )
    throw new UnexpectedSchema();
  return b;
}
export function parseAvailableRange(body: unknown): {
  range: AvailableGlucoseRange | null;
  subject: string;
} {
  const b = envelope(body, "dataRange");
  if (b.egvs === null) return { range: null, subject: b.userId as string };
  const e = b.egvs as
    | { start?: { systemTime?: unknown }; end?: { systemTime?: unknown } }
    | undefined;
  const start = parseSystemTime(e?.start?.systemTime),
    end = parseSystemTime(e?.end?.systemTime);
  if (start === null || end === null || end < start)
    throw new UnexpectedSchema();
  return {
    range: {
      start,
      end,
      sourceStart: e!.start!.systemTime as string,
      sourceEnd: e!.end!.systemTime as string,
    },
    subject: b.userId as string,
  };
}
export async function getAvailableRange(deps: AppDeps, userId: string) {
  return parseAvailableRange(
    await dexcomFetch(deps, userId, "/v3/users/self/dataRange"),
  );
}
export async function retrieveReadings(
  deps: AppDeps,
  userId: string,
  requested: GlucoseWindow,
  revision: string,
): Promise<DexcomDataResult> {
  if (!validWindow(requested))
    throw new HttpError(
      400,
      "bad_range",
      "Select a positive UTC interval of at most 30 days.",
    );
  const initial = loadConnection(deps, userId);
  if (
    !initial ||
    initial.generation !== revision ||
    initial.status !== "connected"
  )
    throw new ReconnectRequired();
  const { range, subject } = await getAvailableRange(deps, userId);
  const window = range ? intersectWindow(requested, range) : null;
  const result: DexcomDataResult = {
    source: "dexcom",
    environment: "sandbox",
    window: requested,
    range,
    connectionRevision: revision,
    retrievedAt: deps.now(),
    readings: [],
    receivedCount: 0,
    rejectedCount: 0,
    duplicateCount: 0,
    outsideWindowCount: 0,
  };
  if (window) {
    const b = envelope(
      await dexcomFetch(deps, userId, "/v3/users/self/egvs", {
        startDate: new Date(window.start).toISOString(),
        endDate: new Date(window.end).toISOString(),
      }),
      "egv",
    );
    if (
      b.userId !== subject ||
      !Array.isArray(b.records) ||
      b.records.length > 20000
    )
      throw new UnexpectedSchema();
    const n = normalizeEgvs(b.records, deps.now());
    result.receivedCount = b.records.length;
    result.rejectedCount = n.rejectedTotal;
    result.duplicateCount = n.duplicates;
    result.readings = n.rows
      .filter((r) => {
        const inside =
          r.systemTimeMs >= window.start && r.systemTimeMs < window.end;
        if (!inside) result.outsideWindowCount++;
        return inside;
      })
      .map(toReading);
  }
  const after = loadConnection(deps, userId);
  if (!after || after.generation !== revision || after.status !== "connected")
    throw new ReconnectRequired();
  return result;
}
function verifySession(ctx: Ctx) {
  const live = findSession(ctx.deps, ctx.req.headers.cookie);
  if (!live || live.idHash !== ctx.session!.idHash)
    throw new HttpError(401, "no_session", "Sign in again.");
}
function safeError(ctx: Ctx, error: unknown): void {
  if (!(error instanceof DexcomError)) throw error;
  if (error instanceof RateLimited) {
    ctx.res.setHeader("Retry-After", String(error.retryAfterSeconds));
    return sendJson(ctx.res, 429, {
      error: "rate_limited",
      retryAfterSeconds: error.retryAfterSeconds,
    });
  }
  sendJson(
    ctx.res,
    error instanceof ReconnectRequired
      ? 409
      : error instanceof Forbidden
        ? 403
        : error instanceof Unavailable
          ? 503
          : 502,
    { error: error.code },
  );
}
export async function availableRangeRoute(ctx: Ctx) {
  requireDiagnostics(ctx);
  limit(ctx.deps, ctx.req, "data-range", 40);
  try {
    const initial = loadConnection(ctx.deps, ctx.session!.userId);
    if (!initial) throw new ReconnectRequired();
    const { range } = await getAvailableRange(ctx.deps, ctx.session!.userId);
    verifySession(ctx);
    const after = loadConnection(ctx.deps, ctx.session!.userId);
    if (
      after?.generation !== initial.generation ||
      after.status !== "connected"
    )
      throw new ReconnectRequired();
    sendJson(ctx.res, 200, {
      source: "dexcom",
      environment: "sandbox",
      range,
      connectionRevision: initial.generation,
    });
  } catch (e) {
    safeError(ctx, e);
  }
}
export async function readingsRoute(ctx: Ctx) {
  requireDiagnostics(ctx);
  limit(ctx.deps, ctx.req, "egvs", 20);
  const b = (await ctx.readJson()) as Record<string, unknown> | null;
  if (
    !b ||
    Array.isArray(b) ||
    typeof b.connectionRevision !== "string" ||
    b.connectionRevision.length > 100
  )
    throw new HttpError(
      400,
      "bad_range",
      "A connection revision and bounded UTC period are required.",
    );
  try {
    const data = await retrieveReadings(
      ctx.deps,
      ctx.session!.userId,
      { start: b.start as number, end: b.end as number },
      b.connectionRevision,
    );
    verifySession(ctx);
    sendJson(ctx.res, 200, data);
  } catch (e) {
    safeError(ctx, e);
  }
}
