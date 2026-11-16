// Server-only token lifecycle and bounded official V3 data requests. No raw-history persistence.
import type { DatabaseSync } from "node:sqlite";
import type { AppDeps } from "../http";
import { decrypt, encrypt, randomToken } from "../crypto";
import { parseTokens, tokenContext, TOKEN_TIMEOUT_MS } from "./oauth";
import { parseProviderTime, validWindow } from "../../src/glucose-window";
import {
  RateLimited,
  ReconnectRequired,
  Unavailable,
  UpstreamRejected,
  Forbidden,
  UnexpectedSchema,
} from "./errors";
export const REFRESH_MARGIN_MS = 60000;
export const REQUEST_TIMEOUT_MS = TOKEN_TIMEOUT_MS;
interface Connection {
  generation: string;
  access_token_enc: string;
  refresh_token_enc: string;
  access_expires_at: number;
  status: string;
  refresh_nonce: string | null;
  refresh_started: number | null;
  backoff_until: number | null;
}
export function loadConnection(deps: AppDeps, userId: string) {
  return deps.db
    .prepare(
      "SELECT generation,access_token_enc,refresh_token_enc,access_expires_at,status,refresh_nonce,refresh_started,backoff_until FROM dexcom_connections WHERE user_id=?",
    )
    .get(userId) as Connection | undefined;
}
const inFlight = new WeakMap<DatabaseSync, Map<string, Promise<void>>>();
function markReconnect(
  deps: AppDeps,
  userId: string,
  generation: string,
  nonce: string,
) {
  deps.db
    .prepare(
      `UPDATE dexcom_connections SET status='needs_reconnect',last_error='needs_reconnect',access_token_enc='',refresh_token_enc='',
    access_expires_at=0,refresh_nonce=NULL,refresh_started=NULL,updated_at=? WHERE user_id=? AND generation=? AND refresh_nonce=?`,
    )
    .run(deps.now(), userId, generation, nonce);
}
export async function ensureFreshConnection(
  deps: AppDeps,
  userId: string,
  force = false,
): Promise<void> {
  const conn = loadConnection(deps, userId);
  if (!conn || conn.status !== "connected" || !deps.tokenKey)
    throw new ReconnectRequired();
  if (conn.backoff_until && conn.backoff_until > deps.now())
    throw new RateLimited(Math.ceil((conn.backoff_until - deps.now()) / 1000));
  if (!force && conn.access_expires_at - deps.now() > REFRESH_MARGIN_MS) return;
  let map = inFlight.get(deps.db);
  if (!map) inFlight.set(deps.db, (map = new Map()));
  const key = `${userId}:${conn.generation}`;
  const existing = map.get(key);
  if (existing) return existing;
  const p = refresh(deps, userId, conn).finally(() => map!.delete(key));
  map.set(key, p);
  return p;
}
async function refresh(deps: AppDeps, userId: string, conn: Connection) {
  const nonce = randomToken();
  // Durable lease prevents multiple backend processes reusing a one-time refresh token.
  const leased = deps.db
    .prepare(
      `UPDATE dexcom_connections SET refresh_nonce=?,refresh_started=?
    WHERE user_id=? AND generation=? AND access_token_enc=? AND status='connected' AND refresh_nonce IS NULL`,
    )
    .run(nonce, deps.now(), userId, conn.generation, conn.access_token_enc);
  if (!leased.changes) {
    const current = loadConnection(deps, userId);
    if (
      current?.refresh_nonce &&
      current.refresh_started !== null &&
      deps.now() - current.refresh_started > TOKEN_TIMEOUT_MS + 5000
    ) {
      markReconnect(deps, userId, current.generation, current.refresh_nonce);
      throw new ReconnectRequired();
    }
    if (
      !current ||
      current.generation !== conn.generation ||
      current.status !== "connected"
    )
      throw new ReconnectRequired();
    if (current.access_token_enc !== conn.access_token_enc) return;
    throw new Unavailable();
  }
  try {
    const res = await deps.fetch(`${deps.config.apiBaseUrl}/v3/oauth2/token`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: decrypt(
          conn.refresh_token_enc,
          deps.tokenKey!,
          tokenContext(userId, conn.generation, "refresh"),
        ),
        client_id: deps.config.clientId,
        client_secret: deps.config.clientSecret,
      }).toString(),
    });
    if (res.status === 429) {
      const raw = res.headers.get("retry-after");
      const seconds = raw ? Number(raw) : NaN;
      const parsed = raw ? Date.parse(raw) : NaN;
      const wait =
        Number.isFinite(seconds) && seconds > 0
          ? seconds * 1000
          : Number.isFinite(parsed) && parsed > deps.now()
            ? parsed - deps.now()
            : 60000;
      deps.db
        .prepare(
          `UPDATE dexcom_connections SET backoff_until=?,refresh_nonce=NULL,refresh_started=NULL,last_error='rate_limited'
        WHERE user_id=? AND generation=? AND refresh_nonce=?`,
        )
        .run(deps.now() + Math.max(1000, wait), userId, conn.generation, nonce);
      throw new RateLimited(Math.ceil(Math.max(1000, wait) / 1000));
    }
    if (!res.ok) throw new ReconnectRequired();
    const t = parseTokens(await res.json());
    if (
      !t ||
      t.refresh_token ===
        decrypt(
          conn.refresh_token_enc,
          deps.tokenKey!,
          tokenContext(userId, conn.generation, "refresh"),
        )
    )
      throw new ReconnectRequired();
    const changed = deps.db
      .prepare(
        `UPDATE dexcom_connections SET access_token_enc=?,refresh_token_enc=?,access_expires_at=?,
      updated_at=?,last_error=NULL,backoff_until=NULL,refresh_nonce=NULL,refresh_started=NULL
      WHERE user_id=? AND generation=? AND refresh_nonce=? AND status='connected'`,
      )
      .run(
        encrypt(
          t.access_token,
          deps.tokenKey!,
          tokenContext(userId, conn.generation, "access"),
        ),
        encrypt(
          t.refresh_token,
          deps.tokenKey!,
          tokenContext(userId, conn.generation, "refresh"),
        ),
        deps.now() + t.expires_in * 1000,
        deps.now(),
        userId,
        conn.generation,
        nonce,
      );
    if (!changed.changes) throw new ReconnectRequired();
  } catch (e) {
    if (e instanceof RateLimited) throw e;
    // An uncertain network outcome may already have consumed the token: never replay it blindly.
    markReconnect(deps, userId, conn.generation, nonce);
    throw new ReconnectRequired();
  }
}
/** Only these official resources are allowed; never proxy a caller-supplied host/path. */
export async function dexcomFetch(
  deps: AppDeps,
  userId: string,
  resource: string,
  query: Record<string, string> = {},
  opts: { timeoutMs?: number } = {},
): Promise<unknown> {
  if (!["/v3/users/self/dataRange", "/v3/users/self/egvs"].includes(resource))
    throw new UpstreamRejected();
  if (resource.endsWith("/egvs")) {
    const start = parseProviderTime(query.startDate),
      end = parseProviderTime(query.endDate);
    if (
      Object.keys(query).length !== 2 ||
      start === null ||
      end === null ||
      !validWindow({ start, end })
    )
      throw new UpstreamRejected();
  } else if (Object.keys(query).length) throw new UpstreamRejected();
  if (
    !deps.config.diagnosticsEnabled ||
    deps.config.nodeEnvironment === "production" ||
    deps.config.environment !== "sandbox" ||
    deps.config.apiBaseUrl !== "https://sandbox-api.dexcom.com"
  )
    throw new UpstreamRejected();
  const initial = loadConnection(deps, userId);
  if (!initial || initial.status !== "connected") throw new ReconnectRequired();
  await ensureFreshConnection(deps, userId);
  let used = loadConnection(deps, userId);
  if (
    !used ||
    used.generation !== initial.generation ||
    used.status !== "connected"
  )
    throw new ReconnectRequired();
  const send = async () => {
    takeDataBudget(deps);
    try {
      return await deps.fetch(
        `${deps.config.apiBaseUrl}${resource}${Object.keys(query).length ? `?${new URLSearchParams(query)}` : ""}`,
        {
          method: "GET",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(opts.timeoutMs ?? REQUEST_TIMEOUT_MS),
          headers: {
            Authorization: `Bearer ${decrypt(used!.access_token_enc, deps.tokenKey!, tokenContext(userId, used!.generation, "access"))}`,
            Accept: "application/json",
          },
        },
      );
    } catch {
      throw new Unavailable();
    }
  };
  let res = await send();
  if (res.status === 401) {
    await res.body?.cancel();
    const current = loadConnection(deps, userId);
    if (!current || current.generation !== initial.generation)
      throw new ReconnectRequired();
    await ensureFreshConnection(
      deps,
      userId,
      current.access_token_enc === used.access_token_enc,
    );
    used = loadConnection(deps, userId);
    if (
      !used ||
      used.generation !== initial.generation ||
      used.status !== "connected"
    )
      throw new ReconnectRequired();
    res = await send();
    if (res.status === 401) {
      deps.db
        .prepare(
          "UPDATE dexcom_connections SET status='needs_reconnect',last_error='needs_reconnect',access_token_enc='',refresh_token_enc='' WHERE user_id=? AND generation=?",
        )
        .run(userId, initial.generation);
      await res.body?.cancel();
      throw new ReconnectRequired();
    }
  }
  const final = loadConnection(deps, userId);
  if (
    !final ||
    final.generation !== initial.generation ||
    final.status !== "connected"
  ) {
    await res.body?.cancel();
    throw new ReconnectRequired();
  }
  if (res.status === 429) {
    const wait = retryDelay(res, deps.now());
    deps.db
      .prepare(
        "UPDATE dexcom_connections SET backoff_until=?,last_error='rate_limited' WHERE user_id=? AND generation=?",
      )
      .run(deps.now() + wait * 1000, userId, initial.generation);
    await res.body?.cancel();
    throw new RateLimited(wait);
  }
  if (!res.ok) {
    await res.body?.cancel();
    if (res.status === 403) throw new Forbidden();
    if (res.status >= 500) throw new Unavailable();
    throw new UpstreamRejected();
  }
  return boundedJson(res);
}
export function retryDelay(res: Response, now: number): number {
  const v = res.headers.get("retry-after");
  const seconds = v ? Number(v) : NaN;
  const date = v ? Date.parse(v) : NaN;
  return Math.ceil(
    Math.max(
      1,
      Number.isFinite(seconds) && seconds > 0
        ? seconds
        : Number.isFinite(date) && date > now
          ? (date - now) / 1000
          : 60,
    ),
  );
}
const budgets = new WeakMap<AppDeps, { count: number; until: number }>();
function takeDataBudget(deps: AppDeps) {
  let b = budgets.get(deps);
  if (!b || b.until <= deps.now())
    budgets.set(deps, (b = { count: 0, until: deps.now() + 3600000 }));
  if (++b.count > 1000)
    throw new RateLimited(Math.ceil((b.until - deps.now()) / 1000));
}
async function boundedJson(res: Response): Promise<unknown> {
  const reader = res.body?.getReader();
  if (!reader) throw new UnexpectedSchema();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8 * 1024 * 1024) {
        await reader.cancel();
        throw new UnexpectedSchema();
      }
      chunks.push(value);
    }
    const all = new Uint8Array(bytes);
    let at = 0;
    for (const c of chunks) {
      all.set(c, at);
      at += c.length;
    }
    return JSON.parse(new TextDecoder().decode(all));
  } catch (e) {
    if (e instanceof UnexpectedSchema) throw e;
    throw new UnexpectedSchema();
  }
}
