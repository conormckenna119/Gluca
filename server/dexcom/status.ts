import { createHmac } from "node:crypto";
import type { AppDeps } from "../http";
import { HttpError } from "../http";
import type { SessionInfo } from "../session";
import { loadConnection, ensureFreshConnection } from "./client";
import { ReconnectRequired } from "./errors";
export async function connectionStatus(deps: AppDeps, session: SessionInfo) {
  let temporaryError = false;
  const expiry = () =>
    deps.db
      .prepare(
        "SELECT expires_at FROM sessions WHERE id_hash=? AND user_id=? AND expires_at>?",
      )
      .get(session.idHash, session.userId, deps.now()) as
      { expires_at: number } | undefined;
  if (!expiry()) throw new HttpError(401, "no_session", "Sign in again.");
  if (
    deps.mode === "dexcom" &&
    loadConnection(deps, session.userId)?.status === "connected"
  )
    try {
      await ensureFreshConnection(deps, session.userId);
    } catch (e) {
      if (!(e instanceof ReconnectRequired)) temporaryError = true;
    }
  const current = expiry();
  if (!current) throw new HttpError(401, "no_session", "Sign in again.");
  const row = loadConnection(deps, session.userId),
    connected = row?.status === "connected";
  return {
    mode: deps.mode,
    environment: "sandbox" as const,
    connected,
    needsReconnect: row?.status === "needs_reconnect",
    temporaryError,
    connectionRevision: connected ? row!.generation : null,
    cacheScope: connected
      ? createHmac("sha256", deps.sessionSecret)
          .update(`cache:${session.idHash}:${row!.generation}`)
          .digest("hex")
      : null,
    cacheValidUntil: connected
      ? Math.min(current.expires_at, deps.now() + 900000)
      : null,
    retryAfterSeconds:
      row?.backoff_until && row.backoff_until > deps.now()
        ? Math.ceil((row.backoff_until - deps.now()) / 1000)
        : undefined,
  };
}
