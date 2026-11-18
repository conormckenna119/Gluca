import { test } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../server/testkit";
import { defaultProfile, defaultPrivacy } from "../src/domain/profile";
import { photoFixture } from "./e2e/png-proof";
async function fixture() {
  const a = await startApp(),
    one = await a.login(),
    two = await a.login(),
    outsider = await a.login(),
    headers = { "X-Gluca-Request": "1" };
  const community = (path: string, body: unknown, cookie = one) =>
    a.call("POST", "/api/communities/" + path, { cookie, headers, body });
  const profile = async (
    cookie: string,
    handle: string,
    publicMemberships = false,
    revision = 0,
  ) =>
    a.call("POST", "/api/profile", {
      cookie,
      headers,
      body: {
        profile: {
          ...defaultProfile(),
          displayName: "Fictional " + handle,
          username: handle,
          onboarded: true,
          role: "supporting",
          diagnosis: { year: 2001 },
          cgm: { brand: "dexcom", model: "G7" },
          interests: ["running"],
        },
        privacy: { ...defaultPrivacy(), showMemberships: publicMemberships },
        revision,
      },
    });
  await profile(one, "fictional-one");
  await profile(two, "fictional-two");
  const join = (cookie = one, id = "tandem") =>
    community("membership", { id, action: "join", userId: "victim" }, cookie);
  const publish = (cookie = one, extra: Record<string, unknown> = {}) =>
    a.call("POST", "/api/posts", {
      cookie,
      headers,
      body: {
        requestId: "fictional-community-post",
        communityId: "tandem",
        visibility: "public",
        title: "Community update",
        caption: "Synthetic discussion",
        alt: "",
        ...extra,
      },
    });
  const social = (path: string, body: unknown, cookie = two) =>
    a.call("POST", "/api/social/" + path, { cookie, headers, body });
  return {
    ...a,
    one,
    two,
    outsider,
    headers,
    community,
    profile,
    join,
    publish,
    social,
  };
}
test("authenticated explicit join/leave, duplicate prevention, private defaults, public counts and account isolation", async () => {
  const a = await fixture();
  try {
    assert.equal(
      (await a.community("membership", { id: "tandem", action: "join" }, ""))
        .status,
      401,
    );
    assert.equal((await a.call("GET", "/api/communities")).status, 401);
    assert.equal(
      (await a.community("membership", { id: "missing", action: "join" }))
        .status,
      404,
    );
    assert.equal(
      (
        await a.community("membership", {
          id: "tandem",
          action: "edit",
          name: "Hacked",
        })
      ).status,
      400,
    );
    await Promise.all([a.join(), a.join()]);
    assert.equal(
      (
        a.app.deps.db
          .prepare("SELECT COUNT(*) AS n FROM community_memberships")
          .get() as { n: number }
      ).n,
      1,
    );
    let list = await a.call("GET", "/api/communities", { cookie: a.one });
    assert.equal(
      list.json.communities.find((c: { id: string }) => c.id === "tandem")
        .joined,
      true,
    );
    assert.equal(
      list.json.communities.find((c: { id: string }) => c.id === "tandem")
        .memberCount,
      0,
    );
    assert.equal(
      (
        await a.call("GET", "/api/communities", { cookie: a.two })
      ).json.communities.some((c: { joined: boolean }) => c.joined),
      false,
    );
    assert.equal(
      (
        await a.call("GET", "/api/communities/members?id=tandem", {
          cookie: a.two,
        })
      ).json.members.length,
      0,
    );
    await a.community("membership", {
      id: "tandem",
      action: "visibility",
      visible: true,
    });
    assert.equal(
      (
        await a.call("GET", "/api/communities/members?id=tandem", {
          cookie: a.two,
        })
      ).json.members.length,
      0,
    );
    await a.profile(a.one, "fictional-one", true, 1);
    let members = await a.call("GET", "/api/communities/members?id=tandem", {
      cookie: a.two,
    });
    assert.equal(members.json.memberCount, 1);
    assert.ok(!/diagnosis|cgm|interests|birthday/.test(members.text));
    const pub = await a.call(
      "GET",
      "/api/profiles/public?username=fictional-one",
      { cookie: a.two },
    );
    assert.deepEqual(pub.json.communities, ["Tandem users"]);
    await a.community("membership", { id: "tandem", action: "leave" });
    await a.join();
    members = await a.call("GET", "/api/communities/members?id=tandem", {
      cookie: a.two,
    });
    assert.equal(members.json.memberCount, 0);
    assert.equal(
      (
        await a.call("POST", "/api/communities/membership", {
          cookie: a.one,
          body: { id: "tandem", action: "leave" },
        })
      ).status,
      403,
    );
  } finally {
    await a.close();
  }
});
test("community posts use the existing encrypted publisher, are member-restricted, idempotent and absent from outsider feed/images", async () => {
  const a = await fixture();
  try {
    assert.equal((await a.publish()).status, 403);
    await a.join();
    const [first, retry] = await Promise.all([a.publish(), a.publish()]);
    assert.equal(first.status, 200);
    assert.equal(retry.json.post.id, first.json.post.id);
    const p = first.json.post;
    assert.equal(p.communityId, "tandem");
    assert.equal(p.media, undefined);
    assert.equal((await a.publish(a.one, { caption: "Changed" })).status, 409);
    assert.equal(
      (await a.publish(a.one, { visibility: "private" })).status,
      400,
    );
    for (const url of [
      "/api/posts?id=" + p.id,
      "/api/posts?communityId=tandem",
      "/api/social/comments?id=" + p.id,
    ])
      assert.ok(
        [403, 404].includes(
          (await a.call("GET", url, { cookie: a.two })).status,
        ),
      );
    assert.equal(
      (await a.call("GET", "/api/posts", { cookie: a.two })).json.posts.length,
      0,
    );
    await a.join(a.two);
    assert.equal(
      (await a.call("GET", "/api/posts?communityId=tandem", { cookie: a.two }))
        .json.posts.length,
      1,
    );
    assert.equal(
      (await a.call("GET", "/api/posts", { cookie: a.two })).json.posts.length,
      1,
    );
    const image = `data:image/png;base64,${photoFixture(1080, 1350, [20, 100, 90]).toString("base64")}`;
    const photo = (
      await a.publish(a.one, { requestId: "fictional-community-photo", image })
    ).json.post;
    const privatePost = (
      await a.call("POST", "/api/posts", {
        cookie: a.one,
        headers: a.headers,
        body: {
          requestId: "fictional-private-associated",
          visibility: "private",
          title: "Private fixture",
          caption: "Private synthetic fixture",
          alt: "Private fixture",
          image,
        },
      })
    ).json.post;
    // Defense in depth: a future association must never widen an existing Private audience.
    a.app.deps.db
      .prepare("UPDATE feed_posts SET community_id=? WHERE id=?")
      .run("tandem", privatePost.id);
    assert.ok(
      !(
        await a.call("GET", "/api/posts?communityId=tandem", { cookie: a.two })
      ).json.posts.some((p: { id: string }) => p.id === privatePost.id),
    );
    assert.equal(
      (await a.call("GET", privatePost.media.uri, { cookie: a.two })).status,
      404,
    );
    assert.equal(photo.media.width, 1080);
    assert.equal(photo.media.height, 1350);
    assert.equal(
      (await a.call("GET", photo.media.uri, { cookie: a.outsider })).status,
      404,
    );
    assert.equal(
      (await a.call("GET", photo.media.uri, { cookie: a.two })).status,
      200,
    );
    await a.community("membership", { id: "tandem", action: "leave" }, a.two);
    assert.equal(
      (await a.call("GET", photo.media.uri, { cookie: a.two })).status,
      404,
    );
    assert.equal(
      (await a.call("GET", "/api/achievements", { cookie: a.one })).json.awards
        .length,
      0,
    );
    assert.ok(
      !JSON.stringify(
        a.app.deps.db.prepare("SELECT * FROM feed_posts").all(),
      ).includes("Synthetic discussion"),
    );
  } finally {
    await a.close();
  }
});
test("Boost/comment reuse respects group access, blocks, leaving, notifications and genuine award idempotency", async () => {
  const a = await fixture();
  try {
    await a.join();
    const p = (await a.publish()).json.post;
    assert.equal(
      (await a.social("boost", { id: p.id, active: true })).status,
      404,
    );
    await a.join(a.two);
    const boost = await a.social("boost", { id: p.id, active: true });
    assert.equal(boost.status, 200);
    assert.equal(boost.json.unlockedIds.length, 1);
    assert.equal(
      (await a.social("boost", { id: p.id, active: true })).json.unlockedIds
        .length,
      0,
    );
    const comment = await a.social("comments", {
      id: p.id,
      text: "Synthetic group comment",
      requestId: "fictional-group-comment",
    });
    assert.equal(comment.status, 200);
    assert.equal(
      (await a.call("GET", "/api/social/notifications", { cookie: a.one })).json
        .notifications.length,
      2,
    );
    const twoId = comment.json.comments[0].authorId;
    await a.social("block", { id: twoId, active: true }, a.one);
    assert.equal(
      (await a.call("GET", "/api/posts?communityId=tandem", { cookie: a.two }))
        .json.posts.length,
      0,
    );
    assert.equal(
      (
        await a.social("comments", {
          id: p.id,
          text: "Forbidden",
          requestId: "fictional-blocked-comment",
        })
      ).status,
      404,
    );
    await a.social("block", { id: twoId, active: false }, a.one);
    await a.community("membership", { id: "tandem", action: "leave" }, a.one);
    assert.equal(
      (await a.call("GET", "/api/social/notifications", { cookie: a.one })).json
        .notifications.length,
      0,
    );
    assert.equal(
      (
        await a.social(
          "comments",
          {
            id: p.id,
            text: "Forbidden after leaving",
            requestId: "fictional-left-comment",
          },
          a.one,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await a.call("GET", "/api/social/comments?id=" + p.id, {
          cookie: a.one,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await a.call("POST", "/api/posts/delete", {
          cookie: a.one,
          headers: a.headers,
          body: { id: p.id },
        })
      ).status,
      200,
    );
  } finally {
    await a.close();
  }
});
test("report receipts are deduplicated, private and enum-only; role provisioning cannot be forged or cross-community", async () => {
  const a = await fixture();
  try {
    await a.join();
    await a.join(a.two);
    const p = (await a.publish()).json.post;
    const r = { kind: "post", id: p.id, reason: "privacy", userId: "victim" };
    await Promise.all([
      a.community("report", r, a.two),
      a.community("report", r, a.two),
    ]);
    assert.equal(
      (
        a.app.deps.db
          .prepare("SELECT COUNT(*) AS n FROM community_reports")
          .get() as { n: number }
      ).n,
      1,
    );
    assert.equal(
      (await a.community("report", { ...r, reason: "private free text" }))
        .status,
      400,
    );
    assert.equal(
      (
        await a.call("GET", "/api/communities/reports?id=tandem", {
          cookie: a.two,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await a.community(
          "moderate",
          {
            communityId: "tandem",
            action: "hide_post",
            id: p.id,
            role: "moderator",
          },
          a.two,
        )
      ).status,
      403,
    );
    const ownerId = p.authorId;
    a.app.deps.db
      .prepare("INSERT INTO community_moderators VALUES(?,?)")
      .run("tandem", ownerId);
    const reports = await a.call("GET", "/api/communities/reports?id=tandem", {
      cookie: a.one,
    });
    assert.equal(reports.status, 200);
    assert.ok(!/reporter_id|Synthetic discussion|diagnosis/.test(reports.text));
    assert.equal(
      (
        await a.community("moderate", {
          communityId: "omnipod",
          action: "hide_post",
          id: p.id,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await a.community("moderate", {
          communityId: "tandem",
          action: "edit_post",
          id: p.id,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await a.community("moderate", {
          communityId: "tandem",
          action: "hide_post",
          id: p.id,
        })
      ).status,
      200,
    );
    assert.equal(
      (await a.call("GET", "/api/posts?id=" + p.id, { cookie: a.two })).status,
      404,
    );
    assert.equal(
      (await a.call("GET", "/api/posts?id=" + p.id, { cookie: a.one })).json
        .post.moderated,
      true,
    );
  } finally {
    await a.close();
  }
});
test("moderation hides comments from counts/inbox, restricts rejoining and does not expose hidden membership data", async () => {
  const a = await fixture();
  try {
    await a.join();
    await a.join(a.two);
    const p = (await a.publish()).json.post;
    const comment = (
      await a.social("comments", {
        id: p.id,
        text: "Synthetic comment to hide",
        requestId: "fictional-hide-comment",
      })
    ).json.comments[0];
    a.app.deps.db
      .prepare("INSERT INTO community_moderators VALUES(?,?)")
      .run("tandem", p.authorId);
    await a.community(
      "report",
      { kind: "comment", id: comment.id, reason: "spam" },
      a.one,
    );
    assert.equal(
      (
        await a.community("moderate", {
          communityId: "tandem",
          action: "hide_comment",
          id: comment.id,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await a.call("GET", "/api/social/comments?id=" + p.id, {
          cookie: a.one,
        })
      ).json.comments.length,
      0,
    );
    assert.equal(
      (await a.call("GET", "/api/posts?id=" + p.id, { cookie: a.two })).json
        .post.commentCount,
      0,
    );
    assert.equal(
      (await a.call("GET", "/api/social/notifications", { cookie: a.one })).json
        .notifications.length,
      0,
    );
    assert.equal(
      (
        await a.community("moderate", {
          communityId: "tandem",
          action: "restrict_member",
          id: comment.authorId,
        })
      ).status,
      200,
    );
    assert.equal((await a.join(a.two)).status, 403);
    assert.equal(
      (await a.call("GET", "/api/posts?id=" + p.id, { cookie: a.two })).status,
      404,
    );
    assert.equal(
      (await a.social("comments/delete", { id: comment.id })).status,
      200,
    );
    assert.equal(
      (
        await a.call("GET", "/api/communities/members?id=tandem", {
          cookie: a.one,
        })
      ).json.members.length,
      0,
    );
  } finally {
    await a.close();
  }
});
