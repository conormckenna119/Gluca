// Sandbox Gluca accounts, distinct from Dexcom credentials. Not production account recovery/MFA.
import { randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { AppDeps, Route, Ctx } from "./http";
import { HttpError, sendJson } from "./http";
import { randomToken, sha256hex, signValue, verifySigned } from "./crypto";
import { limit } from "./limits";
export const COOKIE_NAME = "gluca_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export interface SessionInfo {
  userId: string;
  idHash: string;
}
export function findSession(
  deps: AppDeps,
  cookieHeader: string | undefined,
): SessionInfo | null {
  const raw = (cookieHeader ?? "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw || raw.length > 512) return null;
  const id = verifySigned(raw, deps.sessionSecret);
  if (!id) return null;
  const idHash = sha256hex(id);
  // Existing anonymous sessions cannot authorize Dexcom or be silently promoted to accounts.
  const row = deps.db
    .prepare(
      `SELECT s.user_id, s.expires_at FROM sessions s
    JOIN account_credentials a ON a.user_id=s.user_id WHERE s.id_hash=?`,
    )
    .get(idHash) as { user_id: string; expires_at: number } | undefined;
  return row && row.expires_at > deps.now()
    ? { userId: row.user_id, idHash }
    : null;
}
function cookie(deps: AppDeps, value: string, age = SESSION_TTL_MS / 1000) {
  return `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${deps.config.appBaseUrl.startsWith("https:") ? "; Secure" : ""}`;
}
let passwordJobs = 0;
async function passwordHash(password: string, salt: string): Promise<Buffer> {
  if (passwordJobs >= 4)
    throw new HttpError(429, "rate_limited", "Try again shortly.");
  passwordJobs++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(
        password,
        salt,
        64,
        { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      ),
    );
  } finally {
    passwordJobs--;
  }
}
async function credentials(ctx: Ctx) {
  const b = (await ctx.readJson()) as Record<string, unknown> | null;
  if (
    !b ||
    Array.isArray(b) ||
    typeof b.username !== "string" ||
    typeof b.password !== "string" ||
    !/^[a-zA-Z0-9_.-]{3,40}$/.test(b.username) ||
    b.password.length < 12 ||
    b.password.length > 128
  )
    throw new HttpError(
      400,
      "invalid_credentials",
      "Use a 3–40 character username and a 12–128 character Gluca passphrase.",
    );
  return { username: b.username.toLowerCase(), password: b.password };
}
function issue(ctx: Ctx, userId: string) {
  const { deps, res, session } = ctx;
  const now = deps.now();
  const id = randomToken();
  if (session) {
    deps.db
      .prepare("DELETE FROM oauth_states WHERE session_id_hash=?")
      .run(session.idHash);
    deps.db.prepare("DELETE FROM sessions WHERE id_hash=?").run(session.idHash);
  }
  deps.db
    .prepare(
      "INSERT INTO sessions(id_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)",
    )
    .run(sha256hex(id), userId, now, now + SESSION_TTL_MS);
  res.setHeader("Set-Cookie", cookie(deps, signValue(id, deps.sessionSecret)));
}
async function register(ctx: Ctx) {
  limit(ctx.deps, ctx.req, "account", 10);
  const { username, password } = await credentials(ctx);
  const salt = randomToken(16);
  const hash = await passwordHash(password, salt);
  const { deps } = ctx;
  const userId = randomUUID();
  deps.db.exec("BEGIN IMMEDIATE");
  try {
    if (
      deps.db
        .prepare("SELECT 1 FROM account_credentials WHERE username=?")
        .get(username)
    )
      throw new HttpError(
        409,
        "account_unavailable",
        "That username is unavailable.",
      );
    deps.db
      .prepare("INSERT INTO users(id,created_at) VALUES(?,?)")
      .run(userId, deps.now());
    deps.db
      .prepare(
        "INSERT INTO account_credentials(user_id,username,password_hash,salt) VALUES(?,?,?,?)",
      )
      .run(userId, username, hash.toString("base64"), salt);
    issue(ctx, userId);
    deps.db.exec("COMMIT");
  } catch (e) {
    deps.db.exec("ROLLBACK");
    throw e;
  }
  sendJson(ctx.res, 201, { session: true });
}
async function login(ctx: Ctx) {
  limit(ctx.deps, ctx.req, "signin", 15);
  const { username, password } = await credentials(ctx);
  const row = ctx.deps.db
    .prepare(
      "SELECT user_id,password_hash,salt FROM account_credentials WHERE username=?",
    )
    .get(username) as
    { user_id: string; password_hash: string; salt: string } | undefined;
  const hash = await passwordHash(
    password,
    row?.salt ?? "missing-account-timing-padding",
  );
  const expected = row
    ? Buffer.from(row.password_hash, "base64")
    : Buffer.alloc(64);
  if (
    !row ||
    expected.length !== hash.length ||
    !timingSafeEqual(hash, expected)
  )
    throw new HttpError(
      401,
      "invalid_login",
      "The username or Gluca passphrase is incorrect.",
    );
  issue(ctx, row.user_id);
  sendJson(ctx.res, 200, { session: true });
}
function logout(ctx: Ctx) {
  const { deps, session, res } = ctx;
  deps.db
    .prepare("DELETE FROM oauth_states WHERE session_id_hash=?")
    .run(session!.idHash);
  deps.db.prepare("DELETE FROM sessions WHERE id_hash=?").run(session!.idHash);
  res.setHeader("Set-Cookie", cookie(deps, "", 0));
  sendJson(res, 200, { session: false });
}
export const sessionRoutes: Route[] = [
  { method: "POST", path: "/api/accounts", session: false, handler: register },
  { method: "POST", path: "/api/session", session: false, handler: login },
  {
    method: "GET",
    path: "/api/session",
    session: false,
    handler: ({ res, session }) => sendJson(res, 200, { session: !!session }),
  },
  { method: "POST", path: "/api/session/logout", handler: logout },
];
