import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import { startApp } from "../../server/testkit";
import { defaultProfile, defaultPrivacy } from "../../src/domain/profile";
import { photoFixture, pngProof } from "./png-proof";
const button = (p: Page, name: string) =>
  p.getByRole("button", { name, exact: true }).filter({ visible: true }).last();
async function fixture(page: Page) {
  const a = await startApp({ serveWeb: true, webRoot: path.resolve("dist") });
  a.app.deps.config.appBaseUrl = a.base;
  const one = await a.login(),
    two = await a.login(),
    headers = { "X-Gluca-Request": "1" };
  const profile = (cookie: string, publicMemberships = false, revision = 0) =>
    a.call("POST", "/api/profile", {
      cookie,
      headers,
      body: {
        profile: {
          ...defaultProfile(),
          displayName:
            cookie === one
              ? "Fictional community author"
              : "Fictional supporter",
          username:
            cookie === one ? "fictional-discoverer" : "fictional-supporter",
          role: cookie === one ? "living" : "supporting",
          onboarded: true,
          cgm: cookie === one ? { brand: "dexcom", model: "G7" } : undefined,
          delivery: cookie === one ? { method: "tandem" } : undefined,
          interests: ["running"],
        },
        privacy: { ...defaultPrivacy(), showMemberships: publicMemberships },
        revision,
      },
    });
  await profile(one);
  await profile(two);
  const [name, value] = one.split("=");
  await page.context().addCookies([{ name, value, url: a.base }]);
  await page.addInitScript(() => {
    localStorage.setItem(
      "gluca-demo-v1",
      JSON.stringify({ seenWelcome: true }),
    );
    localStorage.setItem(
      "gluca-dev-flags",
      "identity,accounts,achievements,communityChallenges,eventLogging,dexcomApi=false,dexcomDiagnostics=false,dexcomSync=false",
    );
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  return { ...a, one, two, headers, profile };
}
async function join(page: Page, base: string, id = "tandem") {
  await page.goto(base + "/community/" + id);
  await button(page, "Join community").click();
  await expect(button(page, "Leave community")).toBeVisible();
}
test("Discover search/categories, private recommendations, explicit join/leave and public membership gates", async ({
  page,
}) => {
  const a = await fixture(page);
  try {
    await page.goto(a.base + "/explore");
    await expect(
      page.getByRole("heading", { name: "Discover", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Suggested for you", { exact: true }),
    ).toBeVisible();
    const publicProfile = await a.call(
      "GET",
      "/api/profiles/public?username=fictional-discoverer",
      { cookie: a.two },
    );
    expect(publicProfile.text).not.toMatch(/cgm|diagnosis|delivery|interests/);
    await page
      .getByRole("textbox", { name: "Search communities", exact: true })
      .fill("Libre");
    await expect(button(page, "Explore Libre users")).toBeVisible();
    expect(
      await page
        .getByRole("button", { name: "Explore Tandem users", exact: true })
        .count(),
    ).toBe(0);
    await button(page, "Support").click();
    await expect(
      page.getByText("No communities match your search.", { exact: true }),
    ).toBeVisible();
    await button(page, "All").click();
    await page
      .getByRole("textbox", { name: "Search communities", exact: true })
      .fill("Tandem");
    await button(page, "Explore Tandem users").click();
    await expect(button(page, "Join community")).toBeVisible();
    expect(
      (
        await a.call("GET", "/api/communities", { cookie: a.one })
      ).json.communities.some((c: { joined: boolean }) => c.joined),
    ).toBe(false);
    await button(page, "Join community").click();
    await expect(
      page.getByText("Joined · Private membership", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("switch", {
        name: "List this membership publicly",
        exact: true,
      })
      .click();
    expect(
      (
        await a.call("GET", "/api/communities/members?id=tandem", {
          cookie: a.two,
        })
      ).json.memberCount,
    ).toBe(0);
    await a.profile(a.one, true, 1);
    await page.reload();
    await expect(
      page.getByText("Joined · Public membership", { exact: true }),
    ).toBeVisible();
    await button(page, "View public members").click();
    await expect(
      page.getByRole("dialog", { name: "Public members" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("dialog")
        .getByText("Fictional community author", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await button(page, "Report community").click();
    await expect(
      page.getByRole("dialog", { name: "Report community" }),
    ).toBeVisible();
    await button(page, "Privacy concern").click();
    await expect(
      page.getByText("Report recorded.", { exact: true }),
    ).toBeVisible();
    await button(page, "Leave community").click();
    await expect(
      page.getByRole("dialog", { name: "Leave community?" }),
    ).toBeVisible();
    await button(page, "Confirm leave").click();
    await expect(button(page, "Join community")).toBeVisible();
    expect(
      (
        await a.call("GET", "/api/communities/members?id=tandem", {
          cookie: a.two,
        })
      ).json.memberCount,
    ).toBe(0);
  } finally {
    await a.close();
  }
});
test("text/photo/story publication uses existing posts, supports member Boosts/comments/reports and revokes access on leave", async ({
  page,
  browser,
}) => {
  const a = await fixture(page);
  let other;
  try {
    await join(page, a.base);
    await page
      .getByRole("textbox", { name: "Community post", exact: true })
      .fill("Fictional community discussion");
    let writes = 0;
    await page.route("**/api/posts", async (route) => {
      if (route.request().method() === "POST") writes++;
      await route.continue();
    });
    await button(page, "Post to community").evaluate((el) => {
      for (let i = 0; i < 6; i++) (el as HTMLElement).click();
    });
    await expect(button(page, "Open community post")).toBeVisible();
    expect(writes).toBe(1);
    await page.unroute("**/api/posts");
    let posts = (
      await a.call("GET", "/api/posts?communityId=tandem", { cookie: a.one })
    ).json.posts;
    expect(posts).toHaveLength(1);
    const textPost = posts[0];
    expect(
      (await a.call("GET", "/api/posts?id=" + textPost.id, { cookie: a.two }))
        .status,
    ).toBe(404);
    const chooser = page.waitForEvent("filechooser");
    await button(page, "Add a photo behind it").click();
    await (
      await chooser
    ).setFiles({
      name: "synthetic-photo.png",
      mimeType: "image/png",
      buffer: photoFixture(800, 600, [50, 100, 125]),
    });
    await expect(
      page.getByRole("img", { name: "Community photograph preview" }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Community post", exact: true })
      .fill("Fictional photograph");
    await button(page, "Post to community").click();
    await expect(
      page
        .getByText("Fictional photograph", { exact: true })
        .filter({ visible: true })
        .last(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Photo", exact: true }),
    ).toBeVisible();
    posts = (
      await a.call("GET", "/api/posts?communityId=tandem", { cookie: a.one })
    ).json.posts;
    const photo = posts.find((p: { media?: unknown }) => p.media);
    expect(photo.media.width).toBe(1080);
    expect(photo.media.height).toBe(1350);
    await button(page, "Create a glucose story for this community").click();
    await expect(
      page.getByRole("switch", { name: "Also post to Gluca" }),
    ).not.toBeChecked();
    await page.getByRole("switch", { name: "Also post to Gluca" }).click();
    await expect(
      page.getByText(/Audience: Tandem users members/),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Post caption (optional)", exact: true })
      .fill("Fictional member recap");
    await button(page, "Export & Post").click();
    await expect(
      page.getByRole("dialog", { name: "Confirm Gluca post" }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm Export & Post", exact: true })
      .click();
    const bytes = await readFile((await (await download).path())!);
    expect(pngProof(bytes).width).toBe(1080);
    await expect(button(page, "View published post")).toBeVisible();
    posts = (
      await a.call("GET", "/api/posts?communityId=tandem", { cookie: a.one })
    ).json.posts;
    const recap = posts.find(
      (p: { caption: string }) => p.caption === "Fictional member recap",
    );
    expect(recap.communityId).toBe("tandem");
    const served = Buffer.from(
      await (
        await fetch(a.base + recap.media.uri, { headers: { Cookie: a.one } })
      ).arrayBuffer(),
    );
    expect(served.equals(bytes)).toBe(true);
    other = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const [name, value] = a.two.split("=");
    await other.addCookies([{ name, value, url: a.base }]);
    await other.addInitScript(() => {
      localStorage.setItem(
        "gluca-demo-v1",
        JSON.stringify({ seenWelcome: true }),
      );
      localStorage.setItem(
        "gluca-dev-flags",
        "identity,accounts,achievements,communityChallenges,dexcomApi=false,dexcomDiagnostics=false,dexcomSync=false",
      );
    });
    const supporter = await other.newPage();
    await join(supporter, a.base);
    await supporter.goto(a.base + "/post/" + recap.id);
    const boost = button(supporter, "Give a Boost, 0");
    await boost.click();
    await expect(button(supporter, "Remove your Boost, 1")).toBeVisible();
    await supporter
      .getByRole("textbox", { name: "Your comment", exact: true })
      .fill("Synthetic supportive group comment");
    await button(supporter, "Post comment").click();
    await expect(
      supporter.getByText("Synthetic supportive group comment", {
        exact: true,
      }),
    ).toBeVisible();
    await button(supporter, "More options for post: Daily recap").click();
    await expect(
      supporter.getByRole("dialog", { name: "Post options" }),
    ).toBeVisible();
    await button(supporter, "Report post").click();
    await expect(
      supporter.getByRole("dialog", { name: "Report post" }),
    ).toBeVisible();
    await button(supporter, "Spam").click();
    await supporter.goto(a.base + "/community/tandem");
    await button(supporter, "Leave community").click();
    await expect(
      supporter.getByRole("dialog", { name: "Leave community?" }),
    ).toBeVisible();
    await button(supporter, "Confirm leave").click();
    await expect(button(supporter, "Join community")).toBeVisible();
    expect(
      (await a.call("GET", recap.media.uri, { cookie: a.two })).status,
    ).toBe(404);
  } finally {
    await other?.close();
    await a.close();
  }
});
test("Discover and community detail fit mobile/desktop in both themes with persistent navigation", async ({
  page,
}) => {
  const a = await fixture(page);
  try {
    await mkdir("docs/screenshots/stage9b", { recursive: true });
    for (const dark of [false, true]) {
      await page.addInitScript(
        (dark) =>
          localStorage.setItem(
            "gluca-demo-v1",
            JSON.stringify({ seenWelcome: true, dark }),
          ),
        dark,
      );
      for (const width of [375, 430, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(a.base + "/explore");
        await expect(
          page.getByRole("textbox", {
            name: "Search communities",
            exact: true,
          }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page
          .getByRole("textbox", { name: "Search communities", exact: true })
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `docs/screenshots/stage9b/discover-${width}-${dark ? "dark" : "light"}.png`,
        });
        await page.goto(a.base + "/community/supporters");
        await expect(button(page, "Join community")).toBeVisible();
        const box = await button(page, "Join community").boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        await expect(
          page.getByRole("tab", { name: "Explore", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `docs/screenshots/stage9b/community-${width}-${dark ? "dark" : "light"}.png`,
        });
      }
    }
  } finally {
    await a.close();
  }
});
