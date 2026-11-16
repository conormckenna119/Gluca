import { test } from "node:test";
import assert from "node:assert/strict";
import { FAKE, startApp } from "../server/testkit";

const H = { "X-Gluca-Request": "1" };

test("health answers without a session", async () => {
  const a = await startApp();
  try {
    const r = await a.call("GET", "/api/health");
    assert.deepEqual(r.json, { ok: true, mode: "dexcom" });
    assert.equal((await a.call("GET", "/api/nope")).status, 404);
  } finally {
    await a.close();
  }
});

test("session cookie flags, hashed storage and GET /api/session", async () => {
  const a = await startApp();
  try {
    assert.deepEqual((await a.call("GET", "/api/session")).json, {
      session: false,
    });
    const r = await a.call("POST", "/api/accounts", {
      headers: H,
      body: { username: "cookie-test", password: "synthetic-passphrase" },
    });
    assert.equal(r.status, 201);
    const sc = r.headers.get("set-cookie")!;
    assert.match(sc, /^gluca_session=/);
    assert.match(sc, /HttpOnly/);
    assert.match(sc, /SameSite=Lax/);
    assert.match(sc, /Path=\//);
    assert.doesNotMatch(sc, /Secure/);
    const cookie = sc.split(";")[0];
    assert.deepEqual((await a.call("GET", "/api/session", { cookie })).json, {
      session: true,
    });
    const id = cookie.split("=")[1].split(".")[0];
    const stored = a.app.deps.db
      .prepare("SELECT id_hash FROM sessions")
      .get() as { id_hash: string };
    assert.notEqual(stored.id_hash, id);
    // forged signature and expired sessions are rejected
    assert.deepEqual(
      (
        await a.call("GET", "/api/session", {
          cookie: `gluca_session=${id}.forged`,
        })
      ).json,
      { session: false },
    );
    a.clock.now += 31 * 24 * 60 * 60 * 1000;
    assert.deepEqual((await a.call("GET", "/api/session", { cookie })).json, {
      session: false,
    });
  } finally {
    await a.close();
  }
});

test("Secure cookie flag appears for an https app origin", async () => {
  const a = await startApp({ appBaseUrl: "https://app.example.test" });
  try {
    const r = await a.call("POST", "/api/accounts", {
      headers: H,
      body: { username: "secure-test", password: "synthetic-passphrase" },
    });
    assert.match(r.headers.get("set-cookie")!, /; Secure/);
  } finally {
    await a.close();
  }
});

test("POST routes need the header, a session and an allowed origin", async () => {
  const a = await startApp();
  try {
    const cookie = await a.login();
    const noHeader = await a.call("POST", "/api/dexcom/sync", { cookie });
    assert.equal(noHeader.status, 403);
    const noSession = await a.call("POST", "/api/dexcom/sync", { headers: H });
    assert.equal(noSession.status, 401);
    const foreign = await a.call("POST", "/api/dexcom/sync", {
      cookie,
      headers: { ...H, Origin: "http://evil.test" },
    });
    assert.equal(foreign.status, 403);
    assert.equal(foreign.json.error, "bad_origin");
    assert.equal(
      (
        await a.call("POST", "/api/session", {
          headers: { Origin: "http://evil.test", ...H },
        })
      ).status,
      403,
    );
    assert.equal((await a.call("POST", "/api/session")).status, 403);
    const ok = await a.call("POST", "/api/dexcom/sync", {
      cookie,
      headers: { ...H, Origin: FAKE.appBase },
    });
    assert.equal(ok.status, 501, "Stage 3 is disabled");
    assert.equal(ok.json.error, "stage_not_enabled");
    assert.equal(
      (await a.call("POST", "/api/dexcom/disconnect", { cookie, headers: H }))
        .status,
      200,
    );
    assert.equal(
      (await a.call("GET", "/api/dexcom/sync", { cookie })).status,
      405,
    );
    assert.ok(!JSON.stringify(ok.json).includes("at "), "no stack traces");
  } finally {
    await a.close();
  }
});

test("CORS allows only the exact app origin, with credentials", async () => {
  const a = await startApp();
  try {
    const good = await a.call("OPTIONS", "/api/session", {
      headers: { Origin: FAKE.appBase },
    });
    assert.equal(good.status, 204);
    assert.equal(good.headers.get("access-control-allow-origin"), FAKE.appBase);
    assert.equal(good.headers.get("access-control-allow-credentials"), "true");
    const bad = await a.call("OPTIONS", "/api/session", {
      headers: { Origin: "http://evil.test" },
    });
    assert.equal(bad.headers.get("access-control-allow-origin"), null);
  } finally {
    await a.close();
  }
});

test("mock mode: Dexcom routes answer 503, health and sessions still work", async () => {
  const a = await startApp({
    clientId: "",
    clientSecret: "",
    redirectUri: "",
    tokenEncryptionKey: "",
  });
  try {
    assert.deepEqual((await a.call("GET", "/api/health")).json, {
      ok: true,
      mode: "mock",
    });
    const cookie = await a.login();
    assert.ok(cookie.startsWith("gluca_session="));
    for (const [m, p] of [
      ["POST", "/api/dexcom/connect"],
      ["GET", "/api/dexcom/callback?code=x&state=y"],
    ]) {
      const r = await a.call(m, p, { cookie, headers: H });
      assert.equal(r.status, 503, p);
      assert.equal(r.json.error, "dexcom_not_configured");
    }
    const s = await a.call("GET", "/api/dexcom/status", { cookie });
    assert.deepEqual(
      [s.status, s.json.mode, s.json.connected],
      [200, "mock", false],
    );
  } finally {
    await a.close();
  }
});

test("server refuses to start for a production host", async () => {
  await assert.rejects(
    () => startApp({ apiBaseUrl: "https://api.dexcom.com" }),
    /not approved/,
  );
});

test("request log holds only method, path, status and duration, never secrets", async () => {
  const a = await startApp();
  try {
    const cookie = await a.login();
    const r = await a.call("POST", "/api/dexcom/connect?x=1", {
      cookie,
      headers: H,
    });
    const state = new URL(r.json.authorizationUrl).searchParams.get("state")!;
    await a.call(
      "GET",
      `/api/dexcom/callback?code=${FAKE.code}&state=${state}`,
      { cookie },
    );
    await new Promise((res) => setTimeout(res, 20));
    const log = a.logs.join("\n");
    assert.ok(log.includes("GET /api/dexcom/callback 302"));
    for (const s of [
      FAKE.clientSecret,
      FAKE.code,
      FAKE.access,
      FAKE.refresh,
      FAKE.sessionSecret,
      state,
      cookie.split("=")[1],
      "x=1",
      "?",
    ]) {
      assert.ok(!log.includes(s), `log must not contain ${s.slice(0, 6)}`);
    }
  } finally {
    await a.close();
  }
});
