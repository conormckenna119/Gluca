// Tiny router on node:http. Errors are { error, message } with no stack traces.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import type { Config } from "./config";
import { findSession, type SessionInfo } from "./session";
import { serveWeb } from "./static";

export interface AppDeps {
  config: Config;
  mode: "mock" | "dexcom";
  db: DatabaseSync;
  now: () => number;
  fetch: typeof fetch;
  log: (line: string) => void;
  tokenKey: Buffer | null;
  sessionSecret: string;
}

export interface Ctx {
  deps: AppDeps;
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  session: SessionInfo | null;
  readJson: (maxBytes?: number) => Promise<unknown>;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface Route {
  method: "GET" | "POST";
  path: string;
  /** Requires a valid session. Defaults to true. */
  session?: boolean;
  handler: (ctx: Ctx) => Promise<void> | void;
}

export const MAX_BODY_BYTES = 64 * 1024;

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

export function redirect(
  res: ServerResponse,
  location: string,
  extra: Record<string, string> = {},
): void {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    ...extra,
  });
  res.end();
}

async function readBody(
  req: IncomingMessage,
  maxBytes = MAX_BODY_BYTES,
): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > maxBytes)
      throw new HttpError(413, "body_too_large", "Request body is too large.");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function applyCors(
  deps: AppDeps,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.headers.origin === deps.config.appBaseUrl) {
    res.setHeader("Access-Control-Allow-Origin", deps.config.appBaseUrl);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Gluca-Request",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Vary", "Origin");
  }
}

function checkCsrf(deps: AppDeps, req: IncomingMessage): void {
  if (req.headers["x-gluca-request"] !== "1") {
    throw new HttpError(
      403,
      "missing_request_header",
      "This request needs the X-Gluca-Request header.",
    );
  }
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== deps.config.appBaseUrl) {
    throw new HttpError(403, "bad_origin", "This origin is not allowed.");
  }
}

export function createHandler(deps: AppDeps, routes: Route[]) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const started = Date.now();
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";
    res.on("finish", () =>
      deps.log(
        `${method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`,
      ),
    );
    try {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("X-Frame-Options", "DENY");
      applyCors(deps, req, res);
      if (method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (
        url.pathname.replace(/\/$/, "") === "/dexcom-data" &&
        (!deps.config.diagnosticsEnabled ||
          deps.config.nodeEnvironment === "production")
      )
        throw new HttpError(404, "not_found", "No such route.");
      if (
        deps.config.serveWeb &&
        method === "GET" &&
        !url.pathname.startsWith("/api/") &&
        (await serveWeb(url.pathname, res, deps.config.webRoot))
      )
        return;
      const samepath = routes.filter((r) => r.path === url.pathname);
      if (samepath.length === 0)
        throw new HttpError(404, "not_found", "No such route.");
      const route = samepath.find((r) => r.method === method);
      if (!route)
        throw new HttpError(405, "method_not_allowed", "Method not allowed.");
      if (method === "POST") checkCsrf(deps, req);
      const session = findSession(deps, req.headers.cookie);
      if (route.session !== false && !session) {
        throw new HttpError(
          401,
          "no_session",
          "Sign in to your Gluca sandbox account first.",
        );
      }
      await route.handler({
        deps,
        req,
        res,
        url,
        session,
        readJson: async (maxBytes) => parseJson(await readBody(req, maxBytes)),
      });
    } catch (e) {
      if (res.headersSent) return;
      if (e instanceof HttpError)
        sendJson(res, e.status, { error: e.code, message: e.message });
      else
        sendJson(res, 500, {
          error: "server_error",
          message: "Something went wrong.",
        });
    }
  };
}

function parseJson(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "bad_json", "Body must be JSON.");
  }
}
