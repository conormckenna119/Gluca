import { test } from "node:test";
import assert from "node:assert/strict";
import {
  primaryNavigationVisible,
  primaryTabFor,
  existingTabTarget,
} from "../src/nav";
test("normal tabs and nested workflows retain primary navigation, including direct links", () => {
  for (const path of [
    "/",
    "/glucose",
    "/create",
    "/explore",
    "/profile",
    "/profile-edit",
    "/settings",
    "/onboarding",
    "/import",
    "/post/seed-0",
    "/identity-preview",
    "/dexcom-data",
  ])
    assert.equal(primaryNavigationVisible(path), true, path);
});

test("detail navigation targets existing navigator keys without replacing editor routes", () => {
  const tabs = {
    name: "(tabs)",
    state: {
      key: "tabs-key",
      index: 1,
      routes: [{ name: "create" }, { name: "profile" }],
    },
  };
  assert.deepEqual(
    existingTabTarget(
      { key: "root-key", index: 1, routes: [tabs, { name: "profile-edit" }] },
      "create",
    ),
    { key: "tabs-key", params: undefined, pop: { key: "root-key", count: 1 } },
  );
  assert.equal(
    existingTabTarget({ key: "root-key", index: 0, routes: [tabs] }, "create")!
      .pop.count,
    0,
  );
  assert.equal(
    existingTabTarget(
      { key: "root-key", index: 0, routes: [{ name: "profile-edit" }] },
      "create",
    ),
    null,
  );
});

test("SDK 58 synthetic root wrappers still target the owning stack and existing tab navigator", () => {
  const app = {
    key: "app-stack",
    index: 1,
    routes: [
      {
        name: "(tabs)",
        state: {
          key: "existing-tabs",
          index: 0,
          routes: [
            { name: "create", params: { template: "transparent_overlay" } },
          ],
        },
      },
      { name: "profile-edit" },
    ],
  };
  const wrapper = {
    key: "synthetic-root",
    index: 0,
    routes: [{ name: "__root", state: app }],
  };
  assert.deepEqual(existingTabTarget(wrapper, "create"), {
    key: "existing-tabs",
    params: { template: "transparent_overlay" },
    pop: { key: "app-stack", count: 1 },
  });
});
test("only documented entry/authentication exceptions hide the root bar", () => {
  for (const path of [
    "/account",
    "/account?mode=create",
    "/welcome",
    "/welcome/",
  ])
    assert.equal(primaryNavigationVisible(path), false, path);
});
test("detail routes retain the right primary section rather than becoming an unselected hidden tab", () => {
  assert.equal(primaryTabFor("/profile-edit"), "profile");
  assert.equal(primaryTabFor("/profile?username=synthetic"), "profile");
  assert.equal(primaryTabFor("/post/seed-0"), "index");
  assert.equal(primaryTabFor("/import"), "glucose");
  assert.equal(primaryTabFor("/create"), "create");
  assert.equal(primaryTabFor("/explore"), "explore");
});
