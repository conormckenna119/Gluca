// Environment configuration. Never log values from here; only names.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiBaseUrl: string;
  environment: string;
  appBaseUrl: string;
  port: number;
  tokenEncryptionKey: string;
  sessionSecret: string;
  databasePath: string;
  serveWeb?: boolean;
  /** Trusted internal override for static-serving tests, never taken from HTTP input. */
  webRoot?: string;
  diagnosticsEnabled?: boolean;
  nodeEnvironment?: string;
}

export type Env = Record<string, string | undefined>;

export const SANDBOX_HOST = "sandbox-api.dexcom.com";
export const PRODUCTION_REFUSAL =
  "Production Dexcom access is not approved for this project yet. Only the sandbox (sandbox-api.dexcom.com) is allowed.";

/** Tiny .env parser: KEY=value lines, # comments, optional quotes. No expansion. */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && /^(["']).*\1$/.test(value))
      value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

/** Real environment variables win over the .env file. */
export function loadEnv(root: string, base: Env = process.env): Env {
  const file = path.join(root, ".env");
  const fromFile = existsSync(file)
    ? parseEnvFile(readFileSync(file, "utf8"))
    : {};
  return { ...fromFile, ...base };
}

export function readConfig(env: Env): Config {
  const get = (k: string, d = "") => (env[k] ?? "").trim() || d;
  const port = Number(get("BACKEND_PORT", "3000"));
  return {
    clientId: get("DEXCOM_CLIENT_ID"),
    clientSecret: get("DEXCOM_CLIENT_SECRET"),
    redirectUri: get("DEXCOM_REDIRECT_URI"),
    apiBaseUrl: get("DEXCOM_API_BASE_URL", `https://${SANDBOX_HOST}`).replace(
      /\/+$/,
      "",
    ),
    environment: get("DEXCOM_ENVIRONMENT", "sandbox"),
    appBaseUrl: get("APP_BASE_URL", "http://localhost:3000").replace(
      /\/+$/,
      "",
    ),
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 3000,
    tokenEncryptionKey: get("TOKEN_ENCRYPTION_KEY"),
    sessionSecret: get("SESSION_SECRET"),
    databasePath: get("DATABASE_PATH", "server/data/gluca.sqlite"),
    serveWeb: get("SERVE_WEB", "false") === "true",
    diagnosticsEnabled:
      get("ENABLE_DEXCOM_DIAGNOSTICS", "false") === "true" &&
      get("NODE_ENV", "development") !== "production",
    nodeEnvironment: get("NODE_ENV", "development"),
  };
}

export function encryptionKeyBytes(config: Config): Buffer | null {
  if (!config.tokenEncryptionKey) return null;
  const b = Buffer.from(config.tokenEncryptionKey, "base64");
  return b.length === 32 ? b : null;
}

export interface Validation {
  mode: "mock" | "dexcom";
  problems: string[];
}

/** Throws when the config points anywhere but the Dexcom sandbox. */
export function validateConfig(config: Config): Validation {
  let host = "";
  try {
    host = new URL(config.apiBaseUrl).host;
  } catch {
    host = "";
  }
  if (config.environment !== "sandbox" || host !== SANDBOX_HOST)
    throw new Error(PRODUCTION_REFUSAL);
  if (config.apiBaseUrl !== `https://${SANDBOX_HOST}`)
    throw new Error(
      "DEXCOM_API_BASE_URL must be the canonical HTTPS sandbox origin.",
    );
  let appOrigin: URL;
  try {
    appOrigin = new URL(config.appBaseUrl);
    if (!safeAppUrl(appOrigin) || appOrigin.origin !== config.appBaseUrl)
      throw new Error();
  } catch {
    throw new Error(
      "APP_BASE_URL must be an HTTPS origin, or HTTP localhost for local testing.",
    );
  }

  const named: [string, string][] = [
    ["DEXCOM_CLIENT_ID", config.clientId],
    ["DEXCOM_CLIENT_SECRET", config.clientSecret],
    ["DEXCOM_REDIRECT_URI", config.redirectUri],
    ["TOKEN_ENCRYPTION_KEY", config.tokenEncryptionKey],
  ];
  const present = named.filter(([, v]) => v);
  if (present.length === 0) return { mode: "mock", problems: [] };

  const problems = named.filter(([, v]) => !v).map(([k]) => `${k} is missing`);
  if (config.tokenEncryptionKey && !encryptionKeyBytes(config)) {
    problems.push(
      "TOKEN_ENCRYPTION_KEY must be base64 that decodes to 32 bytes",
    );
  }
  if (
    config.redirectUri &&
    !config.redirectUri.endsWith("/api/dexcom/callback")
  ) {
    problems.push("DEXCOM_REDIRECT_URI must end with /api/dexcom/callback");
  }
  if (!config.sessionSecret) problems.push("SESSION_SECRET is missing");
  else if (config.sessionSecret.length < 32)
    problems.push("SESSION_SECRET must contain at least 32 characters");
  if (config.redirectUri) {
    try {
      const u = new URL(config.redirectUri);
      if (
        !safeAppUrl(u) ||
        u.pathname !== "/api/dexcom/callback" ||
        u.search ||
        u.hash ||
        u.origin !== appOrigin.origin
      )
        problems.push(
          "DEXCOM_REDIRECT_URI must use APP_BASE_URL plus /api/dexcom/callback (same browser origin)",
        );
    } catch {
      problems.push(
        "DEXCOM_REDIRECT_URI must be a valid absolute callback URL",
      );
    }
  }
  return { mode: problems.length === 0 ? "dexcom" : "mock", problems };
}
function safeAppUrl(u: URL): boolean {
  return (
    !u.username &&
    !u.password &&
    !u.search &&
    !u.hash &&
    (u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))
  );
}
