import { test } from "node:test";
import assert from "node:assert/strict";
import {
  onSessionEvent,
  sessionEvent,
  parseSessionMessage,
} from "../src/services/session-events";
import { createOAuthClient } from "../src/services/dexcom-oauth";
test("session invalidation carries only lock/check/purge metadata and preserves remote origin", () => {
  const received: unknown[] = [];
  const off = onSessionEvent((e, remote) => received.push([e, remote]));
  sessionEvent("lock");
  sessionEvent("check");
  sessionEvent("purge", true);
  off();
  sessionEvent("lock");
  assert.deepEqual(received, [
    ["lock", false],
    ["check", false],
    ["purge", true],
  ]);
});

test("cross-tab identity invalidation preserves its closed reason without passing private fields", () => {
  assert.deepEqual(
    parseSessionMessage({
      event: "lock",
      reason: "provider",
      diagnosis: "not forwarded",
    }),
    { event: "lock", reason: "provider" },
  );
  assert.deepEqual(parseSessionMessage("lock"), {
    event: "lock",
    reason: "account",
  });
  assert.equal(
    parseSessionMessage({ event: "health", reason: "account" }),
    null,
  );
  assert.equal(
    parseSessionMessage({ event: "lock", reason: "untrusted" }),
    null,
  );
});
test("disconnect invalidates glucose under a provider reason while logout invalidates account identity", async () => {
  const received: string[] = [];
  const off = onSessionEvent((e, _remote, reason) =>
    received.push(`${e}:${reason}`),
  );
  const client = createOAuthClient(
    "",
    (async () => new Response("{}", { status: 200 })) as typeof fetch,
  );
  try {
    await client.disconnect();
    await client.logout();
    assert.deepEqual(received, ["lock:provider", "lock:account"]);
  } finally {
    off();
  }
});
