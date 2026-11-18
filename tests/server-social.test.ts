import { test } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../server/testkit";
import { photoFixture } from "./e2e/png-proof";
import { defaultProfile, defaultPrivacy } from "../src/domain/profile";
import { migrate } from "../server/db";
async function fixture() {
  const a = await startApp(),
    owner = await a.login(),
    other = await a.login(),
    third = await a.login();
  const headers = { "X-Gluca-Request": "1" };
  const write = (path: string, body: unknown, cookie = other) =>
    a.call("POST", `/api/social/${path}`, { body, cookie, headers });
  const create = async (cookie: string, visibility = "public") =>
    (
      await a.call("POST", "/api/posts", {
        cookie,
        headers,
        body: {
          requestId: `fictional-${visibility}-receipt`,
          image: `data:image/png;base64,${photoFixture(1080, 1080, [60, 90, 110]).toString("base64")}`,
          title: "Fictional recap",
          caption: "Synthetic fixture",
          alt: "Synthetic image",
          visibility,
        },
      })
    ).json.post;
  const post = await create(owner),
    their = await create(other),
    privatePost = await create(owner, "private");
  return {
    ...a,
    owner,
    other,
    third,
    headers,
    write,
    post,
    their,
    privatePost,
  };
}
test("Boost desired-state concurrency, exact counts, removal, schema uniqueness, future kinds rejected and genuine medal idempotency", async () => {
  const a = await fixture();
  try {
    const replies = await Promise.all(
      Array.from({ length: 8 }, () =>
        a.write("boost", {
          id: a.post.id,
          active: true,
          userId: a.post.authorId,
          kind: "love",
        }),
      ),
    );
    assert.ok(
      replies.every(
        (r) => r.status === 200 && r.json.post.reactions.counts.boost === 1,
      ),
    );
    assert.equal(replies.flatMap((r) => r.json.unlockedIds).length, 1);
    assert.equal(
      (await a.call("GET", "/api/posts", { cookie: a.owner })).json.posts.find(
        (p: { id: string }) => p.id === a.post.id,
      ).reactions.counts.boost,
      1,
    );
    assert.equal(
      (await a.write("boost", { id: a.post.id, active: true }, a.third)).json
        .post.reactions.counts.boost,
      2,
    );
    assert.throws(() =>
      a.app.deps.db
        .prepare("INSERT INTO post_reactions VALUES(?,?,'boost',0)")
        .run(a.post.id, a.their.authorId),
    );
    const removed = await a.write("boost", { id: a.post.id, active: false });
    assert.equal(removed.json.post.reactions.counts.boost, 1);
    assert.equal(removed.json.post.reactions.mine, null);
    await a.write("boost", { id: a.post.id, active: false });
    assert.deepEqual(
      (await a.write("boost", { id: a.post.id, active: true })).json
        .unlockedIds,
      [],
    );
    assert.equal(
      (await a.write("boost", { id: a.post.id, active: true }, a.owner)).status,
      400,
    );
    assert.equal(
      (await a.write("boost", { id: a.post.id, active: "yes" })).status,
      400,
    );
    assert.equal(
      (
        await a.call("POST", "/api/achievements", {
          cookie: a.third,
          headers: a.headers,
          body: { event: { id: "forged-social", kind: "support_given" } },
        })
      ).status,
      400,
    );
    const awards = (
      await a.call("GET", "/api/achievements", { cookie: a.other })
    ).json.awards;
    assert.equal(
      awards.filter(
        (x: { achievementId: string }) => x.achievementId === "first_support",
      ).length,
      1,
    );
  } finally {
    await a.close();
  }
});
test("social authorization: no anonymous/CSRF/foreign private access, read/write/image and deleted post fail closed", async () => {
  const a = await fixture();
  try {
    for (const path of [
      "/api/social/notifications",
      "/api/social/comments?id=" + a.post.id,
      "/api/social/member",
      "/api/social/blocks",
    ])
      assert.equal((await a.call("GET", path)).status, 401);
    assert.equal(
      (
        await a.call("POST", "/api/social/boost", {
          cookie: a.other,
          body: { id: a.post.id, active: true },
        })
      ).status,
      403,
    );
    for (const path of ["boost", "comments"]) {
      const b = {
        id: a.privatePost.id,
        active: true,
        text: "Private attempt",
        requestId: "fictional-private-comment",
      };
      assert.equal((await a.write(path, b)).status, 404);
    }
    assert.equal(
      (
        await a.call("GET", "/api/social/comments?id=" + a.privatePost.id, {
          cookie: a.other,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await a.call("GET", "/api/posts?id=" + a.privatePost.id, {
          cookie: a.other,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await a.call("GET", "/api/posts?id=" + a.privatePost.id, {
          cookie: a.owner,
        })
      ).status,
      200,
    );
    await a.call("POST", "/api/posts/delete", {
      cookie: a.owner,
      headers: a.headers,
      body: { id: a.post.id },
    });
    assert.equal(
      (await a.write("boost", { id: a.post.id, active: true })).status,
      404,
    );
    assert.equal(
      (await a.call("GET", a.post.media.uri, { cookie: a.other })).status,
      404,
    );
  } finally {
    await a.close();
  }
});
test("encrypted comments: idempotent receipts, ownership deletion, tombstones, counts, bounds and no fabricated awards", async () => {
  const a = await fixture();
  try {
    const b = {
      id: a.post.id,
      text: "Synthetic comment — no real health data",
      requestId: "fictional-comment-receipt",
    };
    const rows = await Promise.all([
      a.write("comments", b),
      a.write("comments", b),
    ]);
    assert.equal(rows[0].status, 200);
    assert.equal(rows[1].json.comments.length, 1);
    const c = rows[0].json.comments[0];
    assert.equal(c.authorId, a.their.authorId);
    assert.equal(c.owned, true);
    assert.equal(c.text, b.text);
    assert.equal(rows[0].json.post.commentCount, 1);
    const raw = JSON.stringify(
      a.app.deps.db.prepare("SELECT * FROM post_comments").all(),
    );
    assert.ok(!raw.includes(b.text));
    assert.ok(!a.logs.join("").includes(b.text));
    assert.equal(
      (await a.write("comments", { ...b, text: "Different" })).status,
      409,
    );
    for (const text of [" ", "x".repeat(1001)])
      assert.equal((await a.write("comments", { ...b, text })).status, 400);
    assert.equal(
      (await a.write("comments/delete", { id: c.id }, a.owner)).status,
      404,
    );
    const ownerView = (
      await a.call("GET", "/api/social/comments?id=" + a.post.id, {
        cookie: a.owner,
      })
    ).json.comments[0];
    assert.equal(ownerView.owned, false);
    assert.equal((await a.write("comments/delete", { id: c.id })).status, 200);
    assert.equal((await a.write("comments/delete", { id: c.id })).status, 200);
    assert.equal((await a.write("comments", b)).status, 409);
    assert.equal(
      (
        await a.call("GET", "/api/social/comments?id=" + a.post.id, {
          cookie: a.owner,
        })
      ).json.comments.length,
      0,
    );
    assert.ok(
      !(
        await a.call("GET", "/api/achievements", { cookie: a.other })
      ).json.awards.some(
        (x: { achievementId: string }) => x.achievementId === "first_support",
      ),
    );
    assert.equal(
      (await a.call("GET", "/api/posts?id=" + a.post.id, { cookie: a.owner }))
        .json.post.commentCount,
      0,
    );
  } finally {
    await a.close();
  }
});
test("follows are unique, owned and counted; notification grouping, read isolation, safe previews and remove/re-add deduplication", async () => {
  const a = await fixture();
  try {
    const id = a.post.authorId;
    await Promise.all([
      a.write("follow", { id, active: true }),
      a.write("follow", { id, active: true }),
    ]);
    let r = await a.call("GET", "/api/social/member?id=" + id, {
      cookie: a.other,
    });
    assert.equal(r.json.followers, 1);
    assert.equal(r.json.following, true);
    assert.equal(
      (await a.call("GET", "/api/social/member", { cookie: a.other })).json
        .followingCount,
      1,
    );
    await a.write("boost", { id: a.post.id, active: true });
    for (let i = 0; i < 2; i++)
      await a.write("comments", {
        id: a.post.id,
        text: `Synthetic comment ${i}`,
        requestId: `fictional-notification-${i}`,
      });
    const inbox = () =>
      a.call("GET", "/api/social/notifications", { cookie: a.owner });
    let n = await inbox();
    assert.equal(n.json.notifications.length, 3);
    assert.ok(
      !/Synthetic comment|caption|diabetesType|diagnosis|mgdl/.test(n.text),
    );
    await a.write("notifications/read", {}, a.other);
    assert.ok(
      (await inbox()).json.notifications.every(
        (x: { seen: boolean }) => !x.seen,
      ),
    );
    await a.write("notifications/read", {}, a.owner);
    assert.ok(
      (await inbox()).json.notifications.every(
        (x: { seen: boolean }) => x.seen,
      ),
    );
    await a.write("boost", { id: a.post.id, active: false });
    await a.write("boost", { id: a.post.id, active: true });
    await a.write("follow", { id, active: false });
    await a.write("follow", { id, active: true });
    assert.ok(
      (await inbox()).json.notifications.every(
        (x: { seen: boolean }) => x.seen,
      ),
    );
    assert.equal(
      (await a.call("GET", "/api/social/notifications", { cookie: a.third }))
        .json.notifications.length,
      0,
    );
    await a.write("comments", {
      id: a.post.id,
      text: "A genuinely new synthetic comment",
      requestId: "fictional-notification-new",
    });
    const regrouped = (await inbox()).json.notifications;
    assert.equal(regrouped.length, 3);
    assert.equal(regrouped.filter((x: { seen: boolean }) => !x.seen).length, 1);
    assert.equal(
      regrouped.find((x: { kind: string }) => x.kind === "comment").seen,
      false,
    );
    await a.write("follow", { id, active: false });
    assert.equal(
      (await a.call("GET", "/api/social/member?id=" + id, { cookie: a.owner }))
        .json.followers,
      0,
    );
  } finally {
    await a.close();
  }
});

test("additive migration preserves existing encrypted publications; repeat migration is safe", async () => {
  const a = await fixture();
  try {
    const db = a.app.deps.db,
      before = db.prepare("SELECT * FROM feed_posts ORDER BY id").all();
    db.exec(
      "DROP TABLE social_notifications; DROP TABLE post_comments; DROP TABLE post_reactions; DROP TABLE user_blocks; DROP TABLE user_follows; PRAGMA user_version=8;",
    );
    migrate(db);
    migrate(db);
    assert.equal(
      (db.prepare("PRAGMA user_version").get() as { user_version: number })
        .user_version,
      9,
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM feed_posts ORDER BY id").all(),
      before,
    );
    assert.equal(
      (await a.call("GET", a.post.media.uri, { cookie: a.other })).status,
      200,
    );
  } finally {
    await a.close();
  }
});

test("rate limit rejects excessive writes and recovers after its window without duplicate reactions", async () => {
  const a = await fixture();
  try {
    for (let i = 0; i < 120; i++)
      assert.equal(
        (await a.write("boost", { id: a.post.id, active: true })).status,
        200,
      );
    assert.equal(
      (await a.write("boost", { id: a.post.id, active: true })).status,
      429,
    );
    assert.equal(
      (
        a.app.deps.db
          .prepare("SELECT COUNT(*) AS n FROM post_reactions")
          .get() as { n: number }
      ).n,
      1,
    );
    a.clock.now += 60001;
    assert.equal(
      (await a.write("boost", { id: a.post.id, active: false })).status,
      200,
    );
  } finally {
    await a.close();
  }
});
test("mutual blocks protect posts/images/comments/profiles/notifications, remove follows and Boosts, and unblock is owner-controlled", async () => {
  const a = await fixture();
  try {
    await a.call("POST", "/api/profile", {
      cookie: a.owner,
      headers: a.headers,
      body: {
        profile: { ...defaultProfile(), username: "fictional-blocked" },
        privacy: defaultPrivacy(),
        revision: 0,
      },
    });
    await a.write("follow", { id: a.post.authorId, active: true });
    await a.write("boost", { id: a.post.id, active: true });
    const c = await a.write("comments", {
      id: a.post.id,
      text: "Synthetic comment",
      requestId: "fictional-block-comment",
    });
    await a.write("block", { id: a.their.authorId, active: true }, a.owner);
    for (const cookie of [a.owner, a.other]) {
      const target = cookie === a.owner ? a.their : a.post;
      assert.equal(
        (await a.write("boost", { id: target.id, active: true }, cookie))
          .status,
        404,
      );
      assert.equal(
        (await a.write("follow", { id: target.authorId, active: true }, cookie))
          .status,
        404,
      );
      assert.equal(
        (await a.call("GET", target.media.uri, { cookie })).status,
        404,
      );
      assert.ok(
        !(await a.call("GET", "/api/posts", { cookie })).json.posts.some(
          (p: { id: string }) => p.id === target.id,
        ),
      );
    }
    assert.equal(
      (
        await a.call("GET", "/api/profiles/public?username=fictional-blocked", {
          cookie: a.other,
        })
      ).status,
      404,
    );
    assert.equal(
      (await a.call("GET", "/api/social/notifications", { cookie: a.owner }))
        .json.notifications.length,
      0,
    );
    assert.equal(
      (await a.call("GET", "/api/social/blocks", { cookie: a.other })).json
        .blocks.length,
      0,
    );
    await a.write("block", { id: a.post.authorId, active: false }); // Cannot remove someone else's block.
    assert.equal(
      (await a.call("GET", a.post.media.uri, { cookie: a.other })).status,
      404,
    );
    assert.equal(
      (await a.write("comments/delete", { id: c.json.comments[0].id })).status,
      200,
    );
    await a.write("block", { id: a.their.authorId, active: false }, a.owner);
    assert.equal(
      (await a.call("GET", a.post.media.uri, { cookie: a.other })).status,
      200,
    );
    const p = (
      await a.call("GET", "/api/posts?id=" + a.post.id, { cookie: a.other })
    ).json.post;
    assert.deepEqual(p.reactions, { counts: {}, mine: null });
    assert.equal(p.isFollowing, false);
  } finally {
    await a.close();
  }
});
