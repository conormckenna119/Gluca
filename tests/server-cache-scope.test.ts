import { test } from "node:test";
import assert from "node:assert/strict";
import { FAKE, startApp } from "../server/testkit";
const H = { "X-Gluca-Request": "1" };
test("cache namespaces are session/connection-bound, expire with authorization and grant no access themselves", async () => {
  const a = await startApp({ diagnosticsEnabled: true });
  try {
    const cookie = await a.login();
    const begin = await a.call("POST", "/api/dexcom/connect", {
      cookie,
      headers: H,
    });
    const state = new URL(begin.json.authorizationUrl).searchParams.get(
      "state",
    );
    await a.call(
      "GET",
      `/api/dexcom/callback?state=${state}&code=${FAKE.code}`,
      { cookie },
    );
    const status = await a.call("GET", "/api/dexcom/status", { cookie });
    assert.equal(status.status, 200);
    assert.match(status.json.cacheScope, /^[a-f0-9]{64}$/);
    assert.equal(status.json.cacheValidUntil, a.clock.now + 900000);
    assert.equal(
      (await a.call("GET", "/api/dexcom/status", { cookie })).json.cacheScope,
      status.json.cacheScope,
    );
    const bob = await a.login();
    assert.equal(
      (await a.call("GET", "/api/dexcom/status", { cookie: bob })).json
        .cacheScope,
      null,
    );
    assert.equal(
      (
        await a.call("GET", "/api/dexcom/data-range", {
          headers: { "X-Gluca-Cache-Scope": status.json.cacheScope },
        })
      ).status,
      401,
    );
    const relogin = await a.call("POST", "/api/session", {
      cookie,
      headers: H,
      body: { username: "test-user-1", password: "synthetic-test-passphrase" },
    });
    const fresh = relogin.headers.get("set-cookie")!.split(";")[0];
    const other = await a.call("GET", "/api/dexcom/status", { cookie: fresh });
    assert.notEqual(other.json.cacheScope, status.json.cacheScope);
    a.app.deps.db
      .prepare("UPDATE sessions SET expires_at=?")
      .run(a.clock.now + 1000);
    assert.equal(
      (await a.call("GET", "/api/dexcom/status", { cookie: fresh })).json
        .cacheValidUntil,
      a.clock.now + 1000,
    );
    await a.call("POST", "/api/dexcom/disconnect", {
      cookie: fresh,
      headers: H,
    });
    assert.equal(
      (await a.call("GET", "/api/dexcom/status", { cookie: fresh })).json
        .cacheScope,
      null,
    );
  } finally {
    await a.close();
  }
});
