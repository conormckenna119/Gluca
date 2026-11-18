import { test } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../server/testkit";
import { defaultProfile, defaultPrivacy } from "../src/domain/profile";
test("encrypted account repository: auth, CSRF, idempotence, concurrent pin constraints, public allowlist and isolation", async () => {
  const a = await startApp();
  try {
    const cookie = await a.login(),
      other = await a.login();
    const headers = { "X-Gluca-Request": "1" };
    const post = (body: unknown, owner = cookie) =>
      a.call("POST", "/api/achievements", { cookie: owner, headers, body });
    assert.equal((await a.call("GET", "/api/achievements")).status, 401);
    assert.equal(
      (await a.call("POST", "/api/achievements", { cookie, body: {} })).status,
      403,
    );
    assert.equal(
      (await post({ event: { id: "bad", kind: "glucose_low" } })).status,
      400,
    );
    const fact = {
      event: { id: "fictional-export", kind: "story_exported" },
      userId: "victim",
      awardedAt: 0,
    };
    const results = await Promise.all([post(fact), post(fact)]);
    assert.equal(results[0].status, 200);
    assert.equal(results[1].json.awards.length, 1);
    const first = results[0].json.awards[0];
    assert.notEqual(first.userId, "victim");
    assert.equal(first.awardedAt, a.clock.now);
    assert.equal(
      (await a.call("GET", "/api/achievements", { cookie: other })).json.awards
        .length,
      0,
    );
    assert.equal(
      (await post({ edit: { type: "pin", id: first.id, value: true } }, other))
        .status,
      400,
    );
    for (const kind of [
      "awareness_confirmed",
      "milestone_confirmed",
      "activity_logged",
    ])
      await post({ event: { id: `fictional-${kind}`, kind } });
    const before = (await a.call("GET", "/api/achievements", { cookie })).json;
    const pins = await Promise.all(
      before.awards.map((x: { id: string }) =>
        post({ edit: { type: "pin", id: x.id, value: true } }),
      ),
    );
    assert.equal(pins.filter((r) => r.status === 200).length, 3);
    let saved = (await a.call("GET", "/api/achievements", { cookie })).json;
    const order = saved.awards
      .filter((x: { pinned: boolean }) => x.pinned)
      .map((x: { id: string }) => x.id)
      .reverse();
    assert.equal(
      (await post({ edit: { type: "reorder", ids: order } })).status,
      200,
    );
    saved = (await a.call("GET", "/api/achievements", { cookie })).json;
    assert.deepEqual(
      saved.awards
        .filter((x: { pinned: boolean }) => x.pinned)
        .map((x: { id: string }) => x.id),
      order,
    );
    const raw = String(
      (
        a.app.deps.db
          .prepare("SELECT payload_enc FROM user_achievements")
          .get() as { payload_enc: string }
      ).payload_enc,
    );
    assert.ok(
      !raw.includes("first_story") && !raw.includes("fictional-export"),
    );
    await a.call("POST", "/api/profile", {
      cookie,
      headers,
      body: {
        profile: { ...defaultProfile(), username: "fictional-cabinet" },
        privacy: defaultPrivacy(),
        revision: 0,
      },
    });
    await post({ edit: { type: "visibility", id: first.id, value: true } });
    let pub = await a.call(
      "GET",
      "/api/profiles/public?username=fictional-cabinet",
      { cookie: other },
    );
    assert.deepEqual(pub.json.medals ?? [], []);
    await post({ edit: { type: "public", value: true } });
    pub = await a.call(
      "GET",
      "/api/profiles/public?username=fictional-cabinet",
      { cookie: other },
    );
    assert.equal(pub.json.medals.length, 1);
    for (const field of [
      "userId",
      "relatedEvent",
      "snapshot",
      "awardedAt",
      "diagnosis",
      "fictional-export",
    ])
      assert.ok(!pub.text.includes(field));
    await post({ edit: { type: "visibility", id: first.id, value: false } });
    assert.deepEqual(
      (
        await a.call("GET", "/api/profiles/public?username=fictional-cabinet", {
          cookie: other,
        })
      ).json.medals,
      [],
    );
  } finally {
    await a.close();
  }
});
