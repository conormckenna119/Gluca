import { test } from "node:test";
import assert from "node:assert/strict";
import { FAKE, startApp, tokenOk, testConfig } from "../server/testkit";
import { validateConfig } from "../server/config";
import { ensureFreshConnection, loadConnection } from "../server/dexcom/client";
import { encrypt, decrypt } from "../server/crypto";
import { tokenContext } from "../server/dexcom/oauth";
const H = { "X-Gluca-Request": "1" };
type App = Awaited<ReturnType<typeof startApp>>;
async function begin(a: App, cookie: string) {
  const r = await a.call("POST", "/api/dexcom/connect", { cookie, headers: H });
  assert.equal(r.status, 200);
  return new URL(r.json.authorizationUrl).searchParams.get("state")!;
}
async function authorize(a: App, cookie: string) {
  const state = await begin(a, cookie);
  const r = await a.call(
    "GET",
    `/api/dexcom/callback?state=${state}&code=${FAKE.code}`,
    { cookie },
  );
  assert.ok(r.headers.get("location")?.endsWith("dexcom=connected"));
}
const count = (a: App, table: string) =>
  Number(
    (
      a.app.deps.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
        n: number;
      }
    ).n,
  );
const user = (a: App) =>
  (
    a.app.deps.db
      .prepare("SELECT user_id FROM account_credentials LIMIT 1")
      .get() as { user_id: string }
  ).user_id;

test("strict configuration rejects protocol, userinfo, path, callback-host and public HTTP mistakes", () => {
  for (const apiBaseUrl of [
    "http://sandbox-api.dexcom.com",
    "https://user@sandbox-api.dexcom.com",
    "https://sandbox-api.dexcom.com/path",
    "https://sandbox-api.dexcom.com?x=1",
  ])
    assert.throws(() => validateConfig(testConfig({ apiBaseUrl })));
  assert.throws(() =>
    validateConfig(testConfig({ appBaseUrl: "http://public.example.test" })),
  );
  for (const redirectUri of [
    "https://elsewhere.test/api/dexcom/callback",
    "http://localhost:3000/api/dexcom/callback?leak=1",
    "http://localhost:3000/api/dexcom/callback#fragment",
  ])
    assert.equal(validateConfig(testConfig({ redirectUri })).mode, "mock");
});
test("accounts authenticate stable owners, rotate sessions, reject wrong password and logout revokes", async () => {
  const a = await startApp();
  try {
    const body = { username: "alice", password: "synthetic-passphrase" };
    const reg = await a.call("POST", "/api/accounts", { headers: H, body });
    assert.equal(reg.status, 201);
    const cookie = reg.headers.get("set-cookie")!.split(";")[0];
    const credentials = a.app.deps.db
      .prepare("SELECT password_hash,salt FROM account_credentials")
      .get();
    assert.ok(!JSON.stringify(credentials).includes(body.password));
    assert.equal(
      (
        await a.call("POST", "/api/session", {
          headers: H,
          body: { ...body, password: "incorrect-passphrase" },
        })
      ).status,
      401,
    );
    const login = await a.call("POST", "/api/session", {
      cookie,
      headers: H,
      body,
    });
    assert.equal(login.status, 200);
    const fresh = login.headers.get("set-cookie")!.split(";")[0];
    assert.notEqual(fresh, cookie);
    assert.equal(
      (await a.call("GET", "/api/dexcom/status", { cookie })).status,
      401,
    );
    await authorize(a, fresh);
    const owner = user(a);
    assert.ok(loadConnection(a.app.deps, owner));
    await a.call("POST", "/api/session/logout", { cookie: fresh, headers: H });
    assert.equal(
      (await a.call("GET", "/api/dexcom/status", { cookie: fresh })).status,
      401,
    );
    const again = await a.call("POST", "/api/session", { headers: H, body });
    const againCookie = again.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (await a.call("GET", "/api/dexcom/status", { cookie: againCookie })).json
        .connected,
      true,
    );
    assert.equal(count(a, "users"), 1);
  } finally {
    await a.close();
  }
});
test("anonymous account creation is removed, input validated and account attempts rate limited", async () => {
  const a = await startApp();
  try {
    assert.equal(
      (await a.call("POST", "/api/session", { headers: H })).status,
      400,
    );
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await a.call("POST", "/api/accounts", {
            headers: H,
            body: { username: "bad", password: "short" },
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await a.call("POST", "/api/accounts", {
          headers: H,
          body: { username: "good", password: "synthetic-passphrase" },
        })
      ).status,
      429,
    );
    assert.equal(count(a, "users"), 0);
  } finally {
    await a.close();
  }
});
test("callback requires initiating browser cookie, ignores forged denial, and newer flows invalidate old state", async () => {
  const a = await startApp();
  try {
    const cookie = await a.login();
    const old = await begin(a, cookie);
    const state = await begin(a, cookie);
    for (const [query, c] of [
      [`state=${old}&code=x`, cookie],
      [`state=${state}&code=x`, undefined],
      ["state=forged&error=access_denied", cookie],
    ] as const) {
      const r = await a.call("GET", `/api/dexcom/callback?${query}`, {
        cookie: c,
      });
      assert.ok(r.headers.get("location")?.endsWith("dexcom=error"));
    }
    assert.equal(a.calls.length, 0);
    await a.call("GET", `/api/dexcom/callback?state=${state}&code=x`, {
      cookie,
    });
    assert.equal(count(a, "dexcom_connections"), 1);
  } finally {
    await a.close();
  }
});
test("callback never requests data or persists raw glucose; disabled data endpoints cannot run", async () => {
  const a = await startApp();
  try {
    const cookie = await a.login();
    await authorize(a, cookie);
    assert.equal(a.calls.length, 1);
    assert.ok(a.calls.every((c) => c.url.endsWith("/v3/oauth2/token")));
    assert.equal(count(a, "egvs"), 0);
    for (const [method, path] of [
      ["POST", "/api/dexcom/sync"],
      ["GET", "/api/glucose"],
      ["POST", "/api/dexcom/delete-data"],
    ])
      assert.equal(
        (await a.call(method, path, { cookie, headers: H })).status,
        501,
      );
    assert.equal(count(a, "egvs"), 0);
    assert.equal(a.calls.length, 1);
  } finally {
    await a.close();
  }
});
test("refresh atomically rotates both tokens, shares concurrent work, and exposes no token fields", async () => {
  const a = await startApp({}, async (_url, init) => {
    if (
      new URLSearchParams(String(init?.body)).get("grant_type") ===
      "authorization_code"
    )
      return tokenOk();
    await new Promise((r) => setTimeout(r, 20));
    return new Response(
      JSON.stringify({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 7200,
        token_type: "Bearer",
      }),
    );
  });
  try {
    const cookie = await a.login();
    await authorize(a, cookie);
    const id = user(a);
    a.clock.now += 7200000;
    await Promise.all(
      Array.from({ length: 8 }, () => ensureFreshConnection(a.app.deps, id)),
    );
    assert.equal(a.calls.length, 2);
    const conn = loadConnection(a.app.deps, id)!;
    assert.equal(
      decrypt(
        conn.refresh_token_enc,
        a.app.deps.tokenKey!,
        tokenContext(id, conn.generation, "refresh"),
      ),
      "rotated-refresh",
    );
    assert.throws(() =>
      decrypt(
        conn.refresh_token_enc,
        a.app.deps.tokenKey!,
        tokenContext("wrong-owner", conn.generation, "refresh"),
      ),
    );
    const s = await a.call("GET", "/api/dexcom/status", { cookie });
    assert.equal(s.json.connected, true);
    for (const secret of [
      "rotated-access",
      "rotated-refresh",
      FAKE.access,
      FAKE.refresh,
    ])
      assert.ok(!s.text.includes(secret));
  } finally {
    await a.close();
  }
});
test("revoked and malformed refresh credentials require reconnect rather than replaying a spent token", async () => {
  for (const reply of [
    () => new Response("{}", { status: 400 }),
    () =>
      new Response(
        JSON.stringify({
          access_token: "replacement",
          expires_in: 7200,
          token_type: "Bearer",
        }),
      ),
    () => Promise.reject(new Error("synthetic timeout")),
  ]) {
    const a = await startApp({}, (_url, init) =>
      new URLSearchParams(String(init?.body)).get("grant_type") ===
      "authorization_code"
        ? tokenOk()
        : reply(),
    );
    try {
      const cookie = await a.login();
      await authorize(a, cookie);
      a.clock.now += 7200000;
      const s = await a.call("GET", "/api/dexcom/status", { cookie });
      assert.equal(s.json.needsReconnect, true);
      assert.equal(s.json.connected, false);
      const n = a.calls.length;
      await a.call("GET", "/api/dexcom/status", { cookie });
      assert.equal(a.calls.length, n);
      assert.equal(loadConnection(a.app.deps, user(a))!.refresh_token_enc, "");
    } finally {
      await a.close();
    }
  }
});
test("429 honors long Retry-After without consuming or replaying credentials during backoff", async () => {
  const a = await startApp({}, (_url, init) =>
    new URLSearchParams(String(init?.body)).get("grant_type") ===
    "authorization_code"
      ? tokenOk()
      : new Response("{}", { status: 429, headers: { "Retry-After": "3600" } }),
  );
  try {
    const cookie = await a.login();
    await authorize(a, cookie);
    a.clock.now += 7200000;
    const s = await a.call("GET", "/api/dexcom/status", { cookie });
    assert.equal(s.json.temporaryError, true);
    const conn = loadConnection(a.app.deps, user(a))!;
    assert.equal(conn.backoff_until, a.clock.now + 3600000);
    assert.ok(conn.refresh_token_enc);
    await a.call("GET", "/api/dexcom/status", { cookie });
    assert.equal(a.calls.length, 2);
  } finally {
    await a.close();
  }
});
test("disconnect isolates users, invalidates pending authorization and keeps no raw-history side effects", async () => {
  const a = await startApp();
  try {
    const alice = await a.login();
    await authorize(a, alice);
    const bob = await a.login();
    assert.equal(
      (await a.call("GET", "/api/dexcom/status", { cookie: bob })).json
        .connected,
      false,
    );
    await a.call("POST", "/api/dexcom/disconnect", { cookie: bob, headers: H });
    assert.equal(
      (await a.call("GET", "/api/dexcom/status", { cookie: alice })).json
        .connected,
      true,
    );
    const state = await begin(a, alice);
    await a.call("POST", "/api/dexcom/disconnect", {
      cookie: alice,
      headers: H,
    });
    const r = await a.call(
      "GET",
      `/api/dexcom/callback?state=${state}&code=x`,
      { cookie: alice },
    );
    assert.ok(r.headers.get("location")?.endsWith("dexcom=error"));
    assert.equal(count(a, "dexcom_connections"), 0);
  } finally {
    await a.close();
  }
});
test("disconnect during code exchange prevents the late response restoring tokens", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let entered!: () => void;
  const started = new Promise<void>((r) => (entered = r));
  const a = await startApp({}, async () => {
    entered();
    await gate;
    return tokenOk();
  });
  try {
    const cookie = await a.login();
    const state = await begin(a, cookie);
    const pending = a.call(
      "GET",
      `/api/dexcom/callback?state=${state}&code=x`,
      { cookie },
    );
    await started;
    await a.call("POST", "/api/dexcom/disconnect", { cookie, headers: H });
    release();
    const r = await pending;
    assert.ok(r.headers.get("location")?.endsWith("dexcom=error"));
    assert.equal(count(a, "dexcom_connections"), 0);
  } finally {
    release();
    await a.close();
  }
});
test("disconnect during refresh prevents an in-flight token response resurrecting connection", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let entered!: () => void;
  const started = new Promise<void>((r) => (entered = r));
  const a = await startApp({}, async (_url, init) => {
    if (
      new URLSearchParams(String(init?.body)).get("grant_type") ===
      "authorization_code"
    )
      return tokenOk();
    entered();
    await gate;
    return new Response(
      JSON.stringify({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 7200,
        token_type: "Bearer",
      }),
    );
  });
  try {
    const cookie = await a.login();
    await authorize(a, cookie);
    a.clock.now += 7200000;
    const pending = a.call("GET", "/api/dexcom/status", { cookie });
    await started;
    await a.call("POST", "/api/dexcom/disconnect", { cookie, headers: H });
    release();
    assert.equal((await pending).json.connected, false);
    assert.equal(count(a, "dexcom_connections"), 0);
  } finally {
    release();
    await a.close();
  }
});
test("abandoned durable refresh lease fails closed after timeout", async () => {
  const a = await startApp();
  try {
    const cookie = await a.login();
    await authorize(a, cookie);
    a.clock.now += 7200000;
    a.app.deps.db
      .prepare(
        "UPDATE dexcom_connections SET refresh_nonce=?,refresh_started=?",
      )
      .run("abandoned", a.clock.now - 30000);
    await a.call("GET", "/api/dexcom/status", { cookie });
    assert.equal(
      loadConnection(a.app.deps, user(a))!.status,
      "needs_reconnect",
    );
    assert.equal(a.calls.length, 1);
  } finally {
    await a.close();
  }
});
