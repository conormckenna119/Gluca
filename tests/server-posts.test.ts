import { test } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../server/testkit";
import { photoFixture } from "./e2e/png-proof";
import { exportedPng } from "../server/post-image";
const image = () =>
  `data:image/png;base64,${photoFixture(1080, 1920, [70, 110, 130]).toString("base64")}`;
test("bounded PNG validation rejects corruption, unsupported dimensions and truncation", () => {
  assert.deepEqual(
    [exportedPng(image()).width, exportedPng(image()).height],
    [1080, 1920],
  );
  assert.throws(() =>
    exportedPng(
      `data:image/png;base64,${photoFixture(64, 48, [0, 0, 0]).toString("base64")}`,
    ),
  );
  assert.throws(() => exportedPng(image().slice(0, -12)));
  const corrupt = photoFixture(1080, 1080, [0, 0, 0]);
  corrupt[40] ^= 1;
  assert.throws(() =>
    exportedPng(`data:image/png;base64,${corrupt.toString("base64")}`),
  );
  assert.throws(() => exportedPng("data:image/svg+xml;base64,AAAA"));
});
test("account post publication: authenticated byte-identical image, visibility, idempotence, encrypted storage and deletion", async () => {
  const a = await startApp();
  try {
    const owner = await a.login(),
      other = await a.login(),
      headers = { "X-Gluca-Request": "1" };
    const body = {
      requestId: "fictional-request-0001",
      image: image(),
      caption: "Fictional optional caption",
      title: "Daily recap",
      alt: "Fictional exported image",
      visibility: "private",
      userId: "victim",
      readings: [{ mgdl: 123 }],
    };
    const post = (b: unknown = body, cookie = owner) =>
      a.call("POST", "/api/posts", { cookie, headers, body: b });
    assert.equal(
      (await a.call("POST", "/api/posts", { headers, body })).status,
      401,
    );
    assert.equal(
      (await a.call("POST", "/api/posts", { cookie: owner, body })).status,
      403,
    );
    assert.equal(
      (await post({ ...body, visibility: "followers" })).status,
      400,
    );
    assert.equal((await post({ ...body, image: "invalid" })).status, 400);
    assert.equal(
      (
        await a.call("POST", "/api/achievements", {
          cookie: owner,
          headers,
          body: {
            event: { kind: "post_published", id: "fictional-forged-post" },
          },
        })
      ).status,
      400,
    );
    const results = await Promise.all([post(), post()]);
    assert.equal(results[0].status, 200);
    assert.equal(results[1].status, 200);
    const p = results[0].json.post;
    assert.equal(results[1].json.post.id, p.id);
    assert.equal(p.owned, true);
    assert.equal(p.visibility, "private");
    assert.equal(
      (await a.call("GET", "/api/posts", { cookie: other })).json.posts.length,
      0,
    );
    assert.equal(
      (await a.call("GET", p.media.uri, { cookie: other })).status,
      404,
    );
    assert.equal((await a.call("GET", p.media.uri)).status, 401);
    const downloaded = Buffer.from(
      await (
        await fetch(a.base + p.media.uri, { headers: { Cookie: owner } })
      ).arrayBuffer(),
    );
    assert.deepEqual(downloaded, Buffer.from(body.image.slice(22), "base64"));
    assert.equal((await post({ ...body, caption: "changed" })).status, 409);
    assert.equal(
      (await a.call("GET", "/api/achievements", { cookie: owner })).json.awards
        .length,
      0,
    );
    const publicResult = await post({
      ...body,
      requestId: "fictional-request-0002",
      visibility: "public",
      caption: "",
    });
    assert.equal(publicResult.status, 200);
    assert.equal(
      (
        await a.call("POST", "/api/achievements", {
          cookie: other,
          headers,
          body: {
            event: { kind: "post_published", id: publicResult.json.post.id },
          },
        })
      ).status,
      400,
    );
    assert.equal(publicResult.json.post.caption, "");
    const visible = (await a.call("GET", "/api/posts", { cookie: other })).json
      .posts;
    assert.equal(visible.length, 1);
    assert.equal(visible[0].owned, false);
    assert.equal(visible[0].visibility, "public");
    assert.equal(
      (await a.call("GET", visible[0].media.uri, { cookie: other })).status,
      200,
    );
    const awards = (await a.call("GET", "/api/achievements", { cookie: owner }))
      .json.awards;
    assert.equal(awards.length, 1);
    assert.equal(awards[0].achievementId, "first_post");
    const row = a.app.deps.db
      .prepare("SELECT metadata_enc,image_enc FROM feed_posts WHERE id=?")
      .get(p.id) as { metadata_enc: string; image_enc: string };
    assert.ok(!row.metadata_enc.includes(body.caption));
    assert.ok(!row.image_enc.includes(body.image.slice(22, 70)));
    assert.ok(!a.logs.join(" ").includes(body.caption));
    assert.ok(!JSON.stringify(p).includes("readings"));
    assert.equal(
      (
        await a.call("POST", "/api/posts/delete", {
          cookie: other,
          headers,
          body: { id: p.id },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await a.call("POST", "/api/posts/delete", {
          cookie: owner,
          headers,
          body: { id: p.id },
        })
      ).status,
      200,
    );
    assert.equal(
      (await a.call("GET", p.media.uri, { cookie: owner })).status,
      404,
    );
    assert.equal((await post()).status, 409);
    assert.equal(
      (
        a.app.deps.db
          .prepare("SELECT image_enc FROM feed_posts WHERE id=?")
          .get(p.id) as { image_enc: string }
      ).image_enc,
      "",
    );
  } finally {
    await a.close();
  }
});
