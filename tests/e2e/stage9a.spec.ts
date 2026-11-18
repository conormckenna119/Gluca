import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { startApp } from "../../server/testkit";
import { defaultProfile, defaultPrivacy } from "../../src/domain/profile";
import { photoFixture } from "./png-proof";
const button = (p: Page, name: string) =>
  p.getByRole("button", { name, exact: true }).filter({ visible: true });
async function setup(page: Page) {
  const a = await startApp({ serveWeb: true, webRoot: path.resolve("dist") });
  a.app.deps.config.appBaseUrl = a.base;
  const author = await a.login(),
    reader = await a.login(),
    headers = { "X-Gluca-Request": "1" };
  for (const [cookie, name, username] of [
    [author, "Fictional author", "fictional-author"],
    [reader, "Fictional supporter", "fictional-reader"],
  ]) {
    const r = await a.call("POST", "/api/profile", {
      cookie,
      headers,
      body: {
        profile: {
          ...defaultProfile(),
          displayName: name,
          username,
          onboarded: true,
          role: cookie === author ? "living" : "supporting",
          ...(cookie === author
            ? { diagnosis: { year: 2006, month: 4, day: 12 } }
            : {}),
        },
        privacy: {
          ...defaultPrivacy(),
          showShield: true,
          showShieldNumber: true,
        },
        revision: 0,
      },
    });
    expect(r.status).toBe(200);
  }
  const post = (
    await a.call("POST", "/api/posts", {
      cookie: author,
      headers,
      body: {
        requestId: "fictional-social-image-1",
        image: `data:image/png;base64,${photoFixture(1080, 1350, [70, 100, 120]).toString("base64")}`,
        title: "Fictional shared recap",
        caption: "Synthetic story fixture",
        alt: "Synthetic graphic",
        visibility: "public",
      },
    })
  ).json.post;
  const [name, value] = reader.split("=");
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
  return { ...a, author, reader, post, headers };
}

test("authenticated Boost optimism/rapid taps/rollback, comments, follows, inbox and mutual blocks", async ({
  page,
  browser,
}) => {
  const a = await setup(page);
  let second;
  try {
    await page.goto(a.base + "/");
    const boost = page
      .getByRole("button", { name: "Give a Boost, 0", exact: true })
      .first();
    await expect(boost).toBeVisible();
    let requests = 0;
    await page.route("**/api/social/boost", async (route) => {
      requests++;
      await new Promise((r) => setTimeout(r, 450));
      await route.continue();
    });
    await boost.evaluate((el) => {
      for (let i = 0; i < 8; i++) (el as HTMLElement).click();
    });
    await expect(
      page
        .getByRole("button", { name: "Remove your Boost, 1", exact: true })
        .first(),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        a
          .call("GET", "/api/posts?id=" + a.post.id, { cookie: a.reader })
          .then((r) => r.json.post.reactions.mine),
      )
      .toBe("boost");
    expect(requests).toBe(1);
    await page.unroute("**/api/social/boost");
    const unlock = page
      .getByRole("alert")
      .filter({ hasText: "Achievement unlocked" });
    await expect(unlock).toBeVisible();
    await unlock
      .getByRole("button", { name: "View Achievement", exact: true })
      .click();
    await expect(
      page
        .getByText(
          "Source: Gluca confirmed a Boost on another member's post.",
          { exact: true },
        )
        .last(),
    ).toBeVisible();
    await page.goto(a.base + "/");
    await page
      .getByRole("button", { name: "Remove your Boost, 1", exact: true })
      .first()
      .click();
    await expect(boost).toBeEnabled();
    await page.route("**/api/social/boost", (r) =>
      r.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
    );
    await boost.click();
    await expect(
      page
        .getByText(
          "Boost could not be confirmed. Refresh to check before retrying.",
        )
        .first(),
    ).toBeVisible();
    await expect(boost).toBeEnabled();
    expect(
      (await a.call("GET", "/api/posts?id=" + a.post.id, { cookie: a.reader }))
        .json.post.reactions.counts.boost ?? 0,
    ).toBe(0);
    await page.unroute("**/api/social/boost");
    await boost.click();
    await expect(
      page
        .getByRole("button", { name: "Remove your Boost, 1", exact: true })
        .first(),
    ).toBeEnabled();
    await button(page, "View @fictional-author").first().click();
    await expect(
      page.getByText("Community profile", { exact: true }).last(),
    ).toBeVisible();
    await expect(
      page.getByText(/Self-reported identity. Shields and emblems/).last(),
    ).toBeVisible();
    await button(page, "Follow").last().click();
    await expect(button(page, "Unfollow").last()).toBeVisible();
    await expect(
      page.getByText("1 followers · 0 following", { exact: true }),
    ).toBeVisible();
    await page.goto(a.base + "/post/" + a.post.id);
    await page
      .getByRole("textbox", { name: "Your comment", exact: true })
      .fill("A fictional supportive comment");
    await button(page, "Post comment").click();
    await expect(
      page.getByText("A fictional supportive comment", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Open profile for Fictional supporter",
      }),
    ).toBeVisible();
    await button(page, "Delete my comment").click();
    await expect(
      page.getByText("A fictional supportive comment", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "Your comment", exact: true })
      .fill("A second fictional comment");
    await button(page, "Post comment").click();
    await expect(
      page.getByText("A second fictional comment", { exact: true }),
    ).toBeVisible();
    second = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const [name, value] = a.author.split("=");
    await second.addCookies([{ name, value, url: a.base }]);
    await second.addInitScript(() => {
      localStorage.setItem(
        "gluca-demo-v1",
        JSON.stringify({ seenWelcome: true }),
      );
      localStorage.setItem(
        "gluca-dev-flags",
        "identity,accounts,achievements,dexcomApi=false,dexcomDiagnostics=false,dexcomSync=false",
      );
    });
    const owner = await second.newPage();
    await owner.goto(a.base + "/");
    await owner.getByRole("button", { name: /^Notifications \(3\)$/ }).click();
    await expect(
      owner.getByRole("button", {
        name: "Fictional supporter gave your post a Boost · New",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      owner.getByRole("button", {
        name: "Fictional supporter commented on your post · New",
        exact: true,
      }),
    ).toBeVisible();
    await button(owner, "Mark all as read").click();
    await expect(
      owner.getByRole("button", {
        name: "Fictional supporter followed you",
        exact: true,
      }),
    ).toBeVisible();
    await owner
      .getByRole("button", {
        name: "Fictional supporter commented on your post",
        exact: true,
      })
      .click();
    await expect(
      owner.getByText("A second fictional comment", { exact: true }),
    ).toBeVisible();
    await expect(button(owner, "Delete my comment")).toHaveCount(0);
    await page.goto(a.base + "/profile?username=fictional-author");
    await expect(
      page.getByText(/Self-reported identity. Shields and emblems/).last(),
    ).toBeVisible();
    await button(page, "Block member").last().click();
    await expect(
      page.getByRole("dialog", { name: "Block this member?" }),
    ).toBeVisible();
    await button(page, "Confirm block").click();
    await expect(
      page.getByText("Fictional shared recap", { exact: true }),
    ).toHaveCount(0);
    expect(
      (await a.call("GET", a.post.media.uri, { cookie: a.reader })).status,
    ).toBe(404);
    await page.goto(a.base + "/profile");
    await button(page, "Blocked members").click();
    await expect(
      page.getByRole("dialog", { name: "Blocked members" }),
    ).toBeVisible();
    await button(page, "Unblock Fictional author").click();
    expect(
      (await a.call("GET", a.post.media.uri, { cookie: a.reader })).status,
    ).toBe(200);
  } finally {
    await second?.close();
    await a.close();
  }
});
test("feed, detail and profile at mobile/desktop sizes in light/dark, image aspect and accessible controls", async ({
  page,
}) => {
  const a = await setup(page);
  try {
    await mkdir("docs/screenshots/stage9a", { recursive: true });
    for (const theme of ["light", "dark"] as const) {
      await page.addInitScript((t) => {
        const s = JSON.parse(localStorage.getItem("gluca-demo-v1") ?? "{}");
        s.dark = t === "dark";
        localStorage.setItem("gluca-demo-v1", JSON.stringify(s));
      }, theme);
      for (const width of [375, 430, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(a.base + "/");
        const image = page.getByTestId("published-graphic").first();
        await expect(image).toBeVisible();
        const box = await image.boundingBox();
        expect(box!.width / box!.height).toBeCloseTo(1080 / 1350, 2);
        await expect(
          page.getByRole("tablist", { name: "Primary navigation" }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        const boost = page
          .getByRole("button", { name: "Give a Boost, 0", exact: true })
          .first();
        const hit = await boost.boundingBox();
        expect(hit!.height).toBeGreaterThanOrEqual(44);
        await boost.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `docs/screenshots/stage9a/feed-${theme}-${width}.png`,
        });
        await page.goto(a.base + "/post/" + a.post.id);
        await expect(
          page.getByRole("textbox", { name: "Your comment", exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await page
          .getByRole("textbox", { name: "Your comment", exact: true })
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `docs/screenshots/stage9a/comments-${theme}-${width}.png`,
        });
        await page.goto(a.base + "/profile?username=fictional-author");
        await expect(
          page.getByText(/Self-reported identity. Shields and emblems/).last(),
        ).toBeVisible();
        await expect(button(page, "Follow").last()).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `docs/screenshots/stage9a/profile-${theme}-${width}.png`,
        });
      }
    }
  } finally {
    await a.close();
  }
});
