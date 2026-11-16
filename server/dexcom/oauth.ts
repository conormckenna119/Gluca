// Dexcom V3 confidential-client OAuth. Only this server exchanges/stores provider credentials.
import type { Config } from "../config";
import type { AppDeps } from "../http";
import { encrypt, randomToken, sha256hex } from "../crypto";
export const STATE_TTL_MS = 10 * 60 * 1000;
export const TOKEN_TIMEOUT_MS = 15000;
export const tokenContext = (
  userId: string,
  generation: string,
  field: "access" | "refresh",
) => `dexcom:sandbox:${userId}:${generation}:${field}`;
export function buildAuthorizeUrl(config: Config, state: string) {
  return `${config.apiBaseUrl}/v3/oauth2/login?${new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: "offline_access", state })}`;
}
export function createState(deps: AppDeps, sessionIdHash: string): string {
  const state = randomToken(32);
  const now = deps.now();
  deps.db.exec("BEGIN IMMEDIATE");
  try {
    // Starting a new flow invalidates older pending flows for this account.
    deps.db
      .prepare(
        "UPDATE users SET oauth_epoch=oauth_epoch+1 WHERE id=(SELECT user_id FROM sessions WHERE id_hash=?)",
      )
      .run(sessionIdHash);
    deps.db
      .prepare(
        `DELETE FROM oauth_states WHERE session_id_hash IN (SELECT id_hash FROM sessions WHERE user_id=(SELECT user_id FROM sessions WHERE id_hash=?))`,
      )
      .run(sessionIdHash);
    deps.db
      .prepare(
        "DELETE FROM oauth_states WHERE expires_at<=? OR used_at IS NOT NULL",
      )
      .run(now);
    deps.db
      .prepare(
        `INSERT INTO oauth_states(state_hash,session_id_hash,created_at,expires_at,oauth_epoch)
      SELECT ?,s.id_hash,?,?,u.oauth_epoch FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=?`,
      )
      .run(sha256hex(state), now, now + STATE_TTL_MS, sessionIdHash);
    deps.db.exec("COMMIT");
    return state;
  } catch (e) {
    deps.db.exec("ROLLBACK");
    throw e;
  }
}
export interface AuthorizationOwner {
  userId: string;
  epoch: number;
  sessionHash: string;
}
/** Callback must carry the same authenticated browser cookie, not merely a valid bearer state. */
export function consumeState(
  deps: AppDeps,
  state: string,
  cookieSessionHash: string | null,
): AuthorizationOwner | null {
  if (!cookieSessionHash || !/^[A-Za-z0-9_-]{43}$/.test(state)) return null;
  const hash = sha256hex(state);
  const row = deps.db
    .prepare(
      `SELECT s.user_id,o.oauth_epoch FROM oauth_states o
    JOIN sessions s ON s.id_hash=o.session_id_hash JOIN users u ON u.id=s.user_id
    JOIN account_credentials a ON a.user_id=s.user_id
    WHERE o.state_hash=? AND o.session_id_hash=? AND o.used_at IS NULL
      AND o.expires_at>? AND s.expires_at>? AND o.oauth_epoch=u.oauth_epoch`,
    )
    .get(hash, cookieSessionHash, deps.now(), deps.now()) as
    { user_id: string; oauth_epoch: number } | undefined;
  if (!row) return null;
  const changed = deps.db
    .prepare(
      "UPDATE oauth_states SET used_at=? WHERE state_hash=? AND used_at IS NULL",
    )
    .run(deps.now(), hash);
  return changed.changes === 1
    ? {
        userId: row.user_id,
        epoch: row.oauth_epoch,
        sessionHash: cookieSessionHash,
      }
    : null;
}
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}
export function parseTokens(j: unknown): TokenResponse | null {
  if (!j || typeof j !== "object") return null;
  const t = j as Record<string, unknown>;
  if (
    typeof t.access_token !== "string" ||
    !t.access_token ||
    t.access_token.length > 16384 ||
    typeof t.refresh_token !== "string" ||
    !t.refresh_token ||
    t.refresh_token.length > 16384 ||
    typeof t.expires_in !== "number" ||
    !Number.isSafeInteger(t.expires_in) ||
    t.expires_in <= 0 ||
    t.expires_in > 86400 * 365 ||
    t.token_type !== "Bearer"
  )
    return null;
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_in: t.expires_in,
  };
}
export async function exchangeCode(
  deps: AppDeps,
  code: string,
): Promise<TokenResponse | null> {
  try {
    const r = await deps.fetch(`${deps.config.apiBaseUrl}/v3/oauth2/token`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: deps.config.redirectUri,
        client_id: deps.config.clientId,
        client_secret: deps.config.clientSecret,
      }).toString(),
    });
    return r.ok ? parseTokens(await r.json()) : null;
  } catch {
    return null;
  }
}
export function storeConnection(
  deps: AppDeps,
  owner: AuthorizationOwner,
  t: TokenResponse,
): boolean {
  if (!deps.tokenKey) throw new Error("No encryption key");
  const now = deps.now();
  const g = randomToken();
  // Recheck ownership after the network await. Logout/disconnect/new authorization wins races.
  const saved = deps.db
    .prepare(
      `INSERT INTO dexcom_connections
    (user_id,environment,region,access_token_enc,refresh_token_enc,access_expires_at,status,created_at,updated_at,generation)
    SELECT u.id,?,'sandbox',?,?,?,'connected',?,?,? FROM users u JOIN sessions s ON s.user_id=u.id
      JOIN account_credentials a ON a.user_id=u.id WHERE u.id=? AND u.oauth_epoch=? AND s.id_hash=? AND s.expires_at>?
    ON CONFLICT(user_id) DO UPDATE SET environment=excluded.environment,region=excluded.region,
      access_token_enc=excluded.access_token_enc,refresh_token_enc=excluded.refresh_token_enc,access_expires_at=excluded.access_expires_at,
      status='connected',updated_at=excluded.updated_at,generation=excluded.generation,refresh_nonce=NULL,refresh_started=NULL,
      last_sync_at=NULL,latest_data_at=NULL,last_error=NULL,backoff_until=NULL,backoff_ms=NULL`,
    )
    .run(
      deps.config.environment,
      encrypt(
        t.access_token,
        deps.tokenKey,
        tokenContext(owner.userId, g, "access"),
      ),
      encrypt(
        t.refresh_token,
        deps.tokenKey,
        tokenContext(owner.userId, g, "refresh"),
      ),
      now + t.expires_in * 1000,
      now,
      now,
      g,
      owner.userId,
      owner.epoch,
      owner.sessionHash,
      now,
    );
  return saved.changes === 1;
}
