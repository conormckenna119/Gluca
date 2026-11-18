import { test } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../server/testkit";
import { photoFixture } from "./e2e/png-proof";
test("private enrollment, completion, replay, isolation, unsupported conditions and award persistence", async () => {
  const a = await startApp();
  try {
    const owner = await a.login(),
      other = await a.login(),
      headers = { "X-Gluca-Request": "1" };
    const send = (body: unknown, cookie = owner) =>
      a.call("POST", "/api/challenges", { cookie, headers, body });
    const get = () => a.call("GET", "/api/challenges", { cookie: owner });
    assert.equal((await a.call("GET", "/api/challenges")).status, 401);
    assert.equal(
      (await a.call("POST", "/api/challenges", { cookie: owner, body: {} }))
        .status,
      403,
    );
    assert.equal(
      (await send({ action: "join", challengeId: "lowest_glucose" })).status,
      400,
    );
    assert.equal(
      (
        await send({
          action: "join",
          challengeId: "awareness_event",
          visibility: "public",
        })
      ).status,
      400,
    );
    assert.equal((await get()).json.participations.length, 0);
    const request = {
      action: "join",
      challengeId: "awareness_event",
      userId: "victim",
    };
    const joins = await Promise.all([send(request), send(request)]);
    assert.equal(joins[0].status, 200);
    assert.equal(joins[1].status, 200);
    let p = (await get()).json.participations[0];
    assert.equal(
      joins[0].json.participations[0].enrollmentId,
      joins[1].json.participations[0].enrollmentId,
    );
    assert.equal(
      (await a.call("GET", "/api/challenges", { cookie: other })).json
        .participations.length,
      0,
    );
    assert.equal(
      (
        await send(
          {
            action: "complete",
            challengeId: p.challengeId,
            enrollmentId: p.enrollmentId,
            confirmed: true,
          },
          other,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await send({
          action: "complete",
          challengeId: p.challengeId,
          enrollmentId: p.enrollmentId,
        })
      ).status,
      400,
    );
    const old = p.enrollmentId;
    await send({
      action: "leave",
      challengeId: p.challengeId,
      enrollmentId: old,
    });
    assert.equal((await get()).json.participations[0].status, "left");
    await send(request);
    p = (await get()).json.participations[0];
    assert.notEqual(p.enrollmentId, old);
    assert.equal(
      (
        await send({
          action: "complete",
          challengeId: p.challengeId,
          enrollmentId: old,
          confirmed: true,
        })
      ).status,
      409,
    );
    const finish = {
      action: "complete",
      challengeId: p.challengeId,
      enrollmentId: p.enrollmentId,
      confirmed: true,
    };
    const results = await Promise.all([send(finish), send(finish)]);
    assert.equal(results[0].status, 200);
    assert.equal(results[1].status, 200);
    assert.equal(
      results.reduce((n, r) => n + r.json.unlockedIds.length, 0),
      1,
    );
    let awards = (await a.call("GET", "/api/achievements", { cookie: owner }))
      .json.awards;
    assert.equal(awards.length, 1);
    assert.equal(awards[0].visibility, "private");
    assert.equal((await get()).json.participations[0].status, "completed");
    await send(request);
    assert.equal((await get()).json.participations[0].status, "completed");
    for (const id of [
      "activity_of_choice",
      "personal_milestone",
      "helpful_experience",
    ]) {
      await send({ action: "join", challengeId: id });
      const part = (await get()).json.participations.find(
        (p: { challengeId: string }) => p.challengeId === id,
      );
      if (id === "helpful_experience") {
        assert.equal(
          (
            await send({
              action: "complete",
              challengeId: id,
              enrollmentId: part.enrollmentId,
              confirmed: true,
              communityId: "invented",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await send({
              action: "complete",
              challengeId: id,
              enrollmentId: part.enrollmentId,
              confirmed: true,
              communityId: "outside_gluca",
              joinedCommunity: true,
            })
          ).status,
          400,
        );
      }
      const done = await send({
        action: "complete",
        challengeId: id,
        enrollmentId: part.enrollmentId,
        confirmed: true,
        ...(id === "helpful_experience"
          ? {
              communityId: "outside_gluca",
              joinedCommunity: true,
              meaningfulInteraction: true,
            }
          : {}),
      });
      assert.equal(done.status, 200);
    }
    awards = (await a.call("GET", "/api/achievements", { cookie: owner })).json
      .awards;
    assert.equal(awards.length, 4);
    assert.ok(
      awards.every(
        (a: { userId: string; visibility: string }) =>
          a.userId !== "victim" && a.visibility === "private",
      ),
    );
    const rows = a.app.deps.db
      .prepare("SELECT payload_enc FROM challenge_participation")
      .all() as { payload_enc: string }[];
    assert.ok(
      rows.every(
        (r) =>
          !r.payload_enc.includes("completedAt") &&
          !r.payload_enc.includes("outside_gluca"),
      ),
    );
    assert.equal(a.calls.length, 0);
    assert.ok(!a.logs.join(" ").includes("enrollmentId"));
  } finally {
    await a.close();
  }
});
test("only a new owned Public post after enrollment completes Share a Moment; medals are reused", async () => {
  const a = await startApp();
  try {
    const cookie = await a.login(),
      headers = { "X-Gluca-Request": "1" };
    const body = {
      requestId: "fictional-past-0001",
      image: `data:image/png;base64,${photoFixture(1080, 1080, [50, 70, 90]).toString("base64")}`,
      title: "Fictional moment",
      caption: "",
      alt: "Fictional photo",
      visibility: "public",
    };
    const post = (input = body) =>
      a.call("POST", "/api/posts", { cookie, headers, body: input });
    await post();
    const join = await a.call("POST", "/api/challenges", {
      cookie,
      headers,
      body: { action: "join", challengeId: "share_moment" },
    });
    const p = join.json.participations[0];
    assert.equal(
      (
        await a.call("POST", "/api/challenges", {
          cookie,
          headers,
          body: {
            action: "complete",
            challengeId: p.challengeId,
            enrollmentId: p.enrollmentId,
            confirmed: true,
          },
        })
      ).status,
      400,
    );
    await post();
    assert.equal(
      (await a.call("GET", "/api/challenges", { cookie })).json
        .participations[0].status,
      "joined",
    );
    await post({
      ...body,
      requestId: "fictional-private-02",
      visibility: "private",
    });
    assert.equal(
      (await a.call("GET", "/api/challenges", { cookie })).json
        .participations[0].status,
      "joined",
    );
    const next = { ...body, requestId: "fictional-new-public-03" };
    await post(next);
    await post(next);
    const stored = (await a.call("GET", "/api/challenges", { cookie })).json
      .participations;
    assert.equal(stored.length, 1);
    assert.equal(stored[0].status, "completed");
    assert.equal(stored[0].source, "verified_post");
    assert.equal(stored[0].visibility, "private");
    const awards = (await a.call("GET", "/api/achievements", { cookie })).json
      .awards;
    assert.equal(
      awards.filter(
        (a: { achievementId: string }) => a.achievementId === "first_post",
      ).length,
      1,
    );
    assert.equal(stored[0].awardId, awards[0].id);
  } finally {
    await a.close();
  }
});
