import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startApp } from "../server/testkit";
test("same-origin static host serves only exported assets/routes, never project files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gluca-static-stage2-"));
  await writeFile(path.join(root, "index.html"), "<h1>Synthetic test app</h1>");
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "assets", "test.js"), "/* synthetic */");
  await writeFile(path.join(root, ".env"), "must-not-serve");
  const a = await startApp({ serveWeb: true, webRoot: root });
  try {
    const page = await a.call("GET", "/settings");
    assert.equal(page.status, 200);
    assert.match(page.text, /Synthetic test/);
    assert.ok(
      page.headers
        .get("content-security-policy")
        ?.includes("frame-ancestors 'none'"),
    );
    assert.equal((await a.call("GET", "/assets/test.js")).status, 200);
    for (const route of [
      "/.env",
      "/server/config.ts",
      "/package.json",
      "/assets/%2eenv",
      "/assets/test.js.map",
      "/_expo/../../.env",
    ])
      assert.equal((await a.call("GET", route)).status, 404, route);
    assert.equal((await a.call("GET", "/api/dexcom/status")).status, 401);
  } finally {
    await a.close();
    await rm(root, { recursive: true, force: true });
  }
});
