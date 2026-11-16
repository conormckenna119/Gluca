import { randomToken } from "./crypto";
import { encryptionKeyBytes, validateConfig, type Config } from "./config";
import { createHandler, type AppDeps } from "./http";
import { openDb } from "./db";
import { routes } from "./routes";
import type { DatabaseSync } from "node:sqlite";

export interface AppOptions {
  config: Config;
  db?: DatabaseSync;
  now?: () => number;
  fetch?: typeof fetch;
  log?: (line: string) => void;
}

/** Builds the request handler. Throws if the config targets anything but the sandbox. */
export function createApp(opts: AppOptions) {
  const validation = validateConfig(opts.config);
  const log = opts.log ?? ((l: string) => console.log(l));
  let sessionSecret = opts.config.sessionSecret;
  if (!sessionSecret) {
    sessionSecret = randomToken(32);
    log(
      "No SESSION_SECRET set: using an ephemeral secret; sessions end when the server restarts.",
    );
  }
  const deps: AppDeps = {
    config: opts.config,
    mode: validation.mode,
    db: opts.db ?? openDb(opts.config.databasePath),
    now: opts.now ?? Date.now,
    fetch: opts.fetch ?? fetch,
    log,
    tokenKey: encryptionKeyBytes(opts.config),
    sessionSecret,
  };
  return { handler: createHandler(deps, routes), deps, validation };
}
