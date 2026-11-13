import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFlags } from "../src/flags";
import { redirectFor, tabVisible, linkVisible, FALLBACK_ROUTE } from "../src/nav";

const defaults = resolveFlags(undefined);
const off = resolveFlags("communityFeed=false,clubs=false");

test("defaults: every route is reachable and every tab and link is visible", () => {
  for (const p of ["/", "/glucose", "/create", "/explore", "/profile", "/settings", "/import", "/post/seed-0", "/welcome"]) {
    assert.equal(redirectFor(p, defaults), null, p);
  }
  for (const t of ["index", "glucose", "create", "explore", "profile"] as const) assert.equal(tabVisible(t, defaults), true, t);
  for (const l of ["import", "post", "home"] as const) assert.equal(linkVisible(l, defaults), true, l);
});

test("communityFeed=false,clubs=false: feed, post detail and Explore redirect to Create; the tabs are hidden", () => {
  for (const p of ["/", "/index", "/post/seed-0", "/post", "/explore", "/explore/"]) {
    assert.equal(redirectFor(p, off), FALLBACK_ROUTE, p);
  }
  assert.equal(FALLBACK_ROUTE, "/create");
  assert.equal(tabVisible("index", off), false);
  assert.equal(tabVisible("explore", off), false);
  assert.equal(tabVisible("create", off), true);
  assert.equal(linkVisible("post", off), false);
  for (const p of ["/create", "/glucose", "/profile", "/settings", "/import", "/welcome"]) assert.equal(redirectFor(p, off), null, p);
});

test("Explore stays while either clubs or the feed is on", () => {
  assert.equal(redirectFor("/explore", resolveFlags("communityFeed=false")), null);
  assert.equal(redirectFor("/explore", resolveFlags("clubs=false")), null);
  assert.equal(tabVisible("explore", resolveFlags("communityFeed=false")), true);
});

test("localCsvImport=false hides the Import route and links", () => {
  const f = resolveFlags("localCsvImport=false");
  assert.equal(redirectFor("/import", f), FALLBACK_ROUTE);
  assert.equal(linkVisible("import", f), false);
  assert.equal(redirectFor("/", f), null);
});

test("query strings and trailing slashes do not bypass a redirect", () => {
  assert.equal(redirectFor("/import?from=welcome", resolveFlags("localCsvImport=false")), FALLBACK_ROUTE);
  assert.equal(redirectFor("/post/seed-0/", off), FALLBACK_ROUTE);
});
