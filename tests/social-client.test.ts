import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acquireBoost,
  releaseBoost,
  socialRequest,
  SocialError,
} from "../src/services/social";
import { sessionEvent } from "../src/services/session-events";
import { captureAchievementScope } from "../src/achievements/events";
test("one in-flight Boost across mounts; an old account completion cannot unlock a new account operation", () => {
  const old = captureAchievementScope();
  assert.equal(acquireBoost("synthetic-post"), true);
  assert.equal(acquireBoost("synthetic-post"), false);
  sessionEvent("lock");
  sessionEvent("check");
  assert.equal(acquireBoost("synthetic-post"), true);
  releaseBoost("synthetic-post", old);
  assert.equal(acquireBoost("synthetic-post"), false);
  releaseBoost("synthetic-post");
  assert.equal(acquireBoost("synthetic-post"), true);
  releaseBoost("synthetic-post");
});
test("authenticated desired-state requests are never automatically replayed; safe errors and stale-account JSON rejected", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = (async (url, init) => {
      calls++;
      assert.equal(url, "/api/social/boost");
      assert.equal(init?.credentials, "include");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        id: "synthetic-post",
        active: true,
      });
      return new Response("{}", { status: 503 });
    }) as typeof fetch;
    await assert.rejects(
      socialRequest("boost", { id: "synthetic-post", active: true }),
      SocialError,
    );
    assert.equal(calls, 1);
    globalThis.fetch = (async () =>
      new Response("{}", { status: 429 })) as typeof fetch;
    await assert.rejects(
      socialRequest("notifications"),
      (e: unknown) => e instanceof SocialError && e.status === 429,
    );
    globalThis.fetch = (async () =>
      ({
        ok: true,
        json: async () => {
          sessionEvent("lock");
          return { private: "synthetic stale data" };
        },
      }) as Response) as typeof fetch;
    await assert.rejects(
      socialRequest("comments?id=synthetic-post"),
      /Account changed/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
