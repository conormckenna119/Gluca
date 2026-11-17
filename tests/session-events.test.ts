import { test } from "node:test";
import assert from "node:assert/strict";
import { onSessionEvent, sessionEvent } from "../src/services/session-events";
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
