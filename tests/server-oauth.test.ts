import { test } from "node:test";
import assert from "node:assert/strict";
import { FAKE, startApp, tokenOk } from "../server/testkit";
import { STATE_TTL_MS } from "../server/dexcom/oauth";

type App = Awaited<ReturnType<typeof startApp>>;

async function withApp(fn: (a: App) => Promise<void>, reply = tokenOk) {
  const a = await startApp({}, reply);
  try {
    await fn(a);
  } finally {
    await a.close();
  }
}

async function beginConnect(a: App, cookie: string): Promise<string> {
  const r = await a.call("POST", "/api/dexcom/connect", {
    cookie,
    headers: { "X-Gluca-Request": "1" },
  });
  assert.equal(r.status, 200);
  const state = new URL(r.json.authorizationUrl).searchParams.get("state");
  assert.ok(state);
  return state;
}

const connections = (a: App) =>
  (
    a.app.deps.db
      .prepare("SELECT COUNT(*) AS n FROM dexcom_connections")
      .get() as { n: number }
  ).n;

test("connect without a session is 401", () =>
  withApp(async (a) => {
    const r = await a.call("POST", "/api/dexcom/connect", {
      headers: { "X-Gluca-Request": "1" },
    });
    assert.equal(r.status, 401);
    assert.equal(r.json.error, "no_session");
  }));

test("connect redirects to the sandbox login and stores only a hash of the state", () =>
  withApp(async (a) => {
    const cookie = await a.login();
    const r = await a.call("POST", "/api/dexcom/connect", {
      cookie,
      headers: { "X-Gluca-Request": "1" },
    });
    const loc = new URL(r.json.authorizationUrl);
    assert.equal(loc.host, "sandbox-api.dexcom.com");
    const state = loc.searchParams.get("state")!;
    const row = a.app.deps.db
      .prepare("SELECT state_hash FROM oauth_states")
      .get() as { state_hash: string };
    assert.notEqual(row.state_hash, state);
    assert.equal(row.state_hash.length, 64);
  }));

test("callback: invalid, missing, expired, reused and foreign-session states store nothing", () =>
  withApp(async (a) => {
    const cookie = await a.login();
    const bad = async (qs: string, c = cookie) => {
      const r = await a.call("GET", `/api/dexcom/callback?${qs}`, {
        cookie: c,
      });
      assert.equal(r.status, 302);
      assert.equal(
        r.headers.get("location"),
        `${FAKE.appBase}/settings?dexcom=error`,
      );
    };
    await bad(`code=${FAKE.code}&state=unknown`);
    await bad(`code=${FAKE.code}`);
    await bad(`state=abc`);

    const expired = await beginConnect(a, cookie);
    a.clock.now += STATE_TTL_MS + 1;
    await bad(`code=${FAKE.code}&state=${expired}`);

    a.clock.now += 1;
    const reused = await beginConnect(a, cookie);
    await bad(`code=${FAKE.code}&state=${reused}&error=server_error`);
    await bad(`code=${FAKE.code}&state=${reused}`);

    const other = await a.login();
    const mine = await beginConnect(a, cookie);
    await bad(`code=${FAKE.code}&state=${mine}`, other);
    assert.equal(connections(a), 0);
    assert.equal(a.calls.length, 0, "no token request for an invalid state");
  }));

test("provider denial redirects with denied and burns the state", () =>
  withApp(async (a) => {
    const cookie = await a.login();
    const state = await beginConnect(a, cookie);
    const r = await a.call(
      "GET",
      `/api/dexcom/callback?error=access_denied&state=${state}`,
      { cookie },
    );
    assert.equal(
      r.headers.get("location"),
      `${FAKE.appBase}/settings?dexcom=denied`,
    );
    const again = await a.call(
      "GET",
      `/api/dexcom/callback?code=${FAKE.code}&state=${state}`,
      { cookie },
    );
    assert.equal(
      again.headers.get("location"),
      `${FAKE.appBase}/settings?dexcom=error`,
    );
    assert.equal(connections(a), 0);
    assert.equal(a.calls.length, 0);
  }));

test("successful exchange stores encrypted tokens and redirects without leaking", () =>
  withApp(async (a) => {
    const cookie = await a.login();
    const state = await beginConnect(a, cookie);
    const r = await a.call(
      "GET",
      `/api/dexcom/callback?code=${FAKE.code}&state=${state}`,
      { cookie },
    );
    assert.equal(r.status, 302);
    const loc = r.headers.get("location")!;
    assert.equal(loc, `${FAKE.appBase}/settings?dexcom=connected`);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.equal(r.headers.get("referrer-policy"), "no-referrer");
    for (const s of [FAKE.code, state, FAKE.access, FAKE.refresh])
      assert.ok(!loc.includes(s));

    assert.equal(a.calls.length, 1);
    assert.equal(
      a.calls[0].url,
      "https://sandbox-api.dexcom.com/v3/oauth2/token",
    );
    const form = new URLSearchParams(a.calls[0].body);
    assert.equal(form.get("grant_type"), "authorization_code");
    assert.equal(form.get("code"), FAKE.code);
    assert.equal(form.get("client_secret"), FAKE.clientSecret);

    const row = a.app.deps.db
      .prepare("SELECT * FROM dexcom_connections")
      .get() as Record<string, string | number>;
    assert.ok(String(row.access_token_enc).startsWith("v2."));
    assert.ok(!JSON.stringify(row).includes(FAKE.access));
    assert.ok(!JSON.stringify(row).includes(FAKE.refresh));
    assert.equal(row.status, "connected");
    assert.equal(row.access_expires_at, a.clock.now + 7200 * 1000);

    const s = await a.call("GET", "/api/dexcom/status", { cookie });
    assert.equal(s.json.connected, true);
    assert.deepEqual(Object.keys(s.json).sort(), [
      "cacheScope",
      "cacheValidUntil",
      "connected",
      "connectionRevision",
      "environment",
      "mode",
      "needsReconnect",
      "temporaryError",
    ]);
    assert.match(s.json.cacheScope, /^[a-f0-9]{64}$/);
    assert.equal(s.json.cacheValidUntil, a.clock.now + 900000);
    assert.ok(
      !s.text.includes(FAKE.access) &&
        !s.text.includes(FAKE.refresh) &&
        !s.text.includes("v1."),
    );
  }));

test("token endpoint failure redirects with error and consumes the state", () =>
  withApp(
    async (a) => {
      const cookie = await a.login();
      const state = await beginConnect(a, cookie);
      const r = await a.call(
        "GET",
        `/api/dexcom/callback?code=${FAKE.code}&state=${state}`,
        { cookie },
      );
      assert.equal(
        r.headers.get("location"),
        `${FAKE.appBase}/settings?dexcom=error`,
      );
      assert.equal(connections(a), 0);
      const used = a.app.deps.db
        .prepare("SELECT used_at FROM oauth_states")
        .get() as { used_at: number | null };
      assert.notEqual(used.used_at, null);
      await a.call(
        "GET",
        `/api/dexcom/callback?code=${FAKE.code}&state=${state}`,
        { cookie },
      );
      assert.equal(a.calls.length, 1, "state cannot be retried");
    },
    () => new Response(`{"error":"invalid_grant"}`, { status: 400 }),
  ));
