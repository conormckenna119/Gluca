// Test helpers (used only by tests/server-*.test.ts). All values here are obviously fake.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Config } from "./config";
import { createApp } from "./app";
import { openDb } from "./db";

export const FAKE = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  code: "test-auth-code",
  access: "test-access-token",
  refresh: "test-refresh-token",
  sessionSecret: "test-session-secret-at-least-32-characters",
  encKey: Buffer.alloc(32, 7).toString("base64"),
  appBase: "http://localhost:3000",
};

export function testConfig(over: Partial<Config> = {}): Config {
  return {
    clientId: FAKE.clientId,
    clientSecret: FAKE.clientSecret,
    redirectUri: `${over.appBaseUrl ?? FAKE.appBase}/api/dexcom/callback`,
    apiBaseUrl: "https://sandbox-api.dexcom.com",
    environment: "sandbox",
    appBaseUrl: FAKE.appBase,
    port: 3000,
    tokenEncryptionKey: FAKE.encKey,
    sessionSecret: FAKE.sessionSecret,
    databasePath: ":memory:",
    ...over,
  };
}

export interface FetchCall {
  url: string;
  body: string;
  auth: string;
}

export type FakeTokenReply = (
  url: string,
  init?: RequestInit,
) => Response | Promise<Response>;

export function tokenOk(): Response {
  return new Response(
    JSON.stringify({
      access_token: FAKE.access,
      refresh_token: FAKE.refresh,
      expires_in: 7200,
      token_type: "Bearer",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

export async function startApp(
  over: Partial<Config> = {},
  reply: FakeTokenReply = tokenOk,
) {
  const logs: string[] = [];
  const calls: FetchCall[] = [];
  const clock = { now: 1_800_000_000_000 };
  const fakeFetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({
      url: String(url),
      body: String(init?.body ?? ""),
      auth: headers.Authorization ?? "",
    });
    return reply(String(url), init);
  }) as typeof fetch;
  const app = createApp({
    config: testConfig(over),
    db: openDb(":memory:"),
    now: () => clock.now,
    fetch: fakeFetch,
    log: (l) => logs.push(l),
  });
  const server: Server = createServer(app.handler);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function call(
    method: string,
    path: string,
    opts: {
      cookie?: string;
      headers?: Record<string, string>;
      body?: unknown;
    } = {},
  ) {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.cookie) headers.Cookie = opts.cookie;
    const res = await fetch(base + path, {
      method,
      headers,
      redirect: "manual",
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    });
    const text = await res.text();
    let json: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON (for example a redirect) */
    }
    return { status: res.status, headers: res.headers, json, text };
  }

  /** Starts a session the way the app does and returns the Cookie header to send back. */
  let accountNumber = 0;
  async function login(): Promise<string> {
    const r = await call("POST", "/api/accounts", {
      headers: { "X-Gluca-Request": "1" },
      body: {
        username: `test-user-${++accountNumber}`,
        password: "synthetic-test-passphrase",
      },
    });
    return (r.headers.get("set-cookie") ?? "").split(";")[0];
  }

  return {
    base,
    app,
    logs,
    calls,
    clock,
    call,
    login,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
