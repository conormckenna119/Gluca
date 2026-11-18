import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { startApp } from "../../server/testkit";
import { defaultProfile, defaultPrivacy } from "../../src/domain/profile";
const button = (p: Page, name: string) =>
  p.getByRole("button", { name, exact: true }).filter({ visible: true });
async function fixture(page: Page) {
  const a = await startApp({ serveWeb: true, webRoot: path.resolve("dist") });
  a.app.deps.config.appBaseUrl = a.base;
  const cookie = await a.login(),
    [name, value] = cookie.split("=");
  await page.context().addCookies([{ name, value, url: a.base }]);
  await a.call("POST", "/api/profile", {
    cookie,
    headers: { "X-Gluca-Request": "1" },
    body: {
      profile: {
        ...defaultProfile(),
        displayName: "Fictional supporter",
        username: "fictional-challenger",
        role: "supporting",
        onboarded: true,
      },
      privacy: defaultPrivacy(),
      revision: 0,
    },
  });
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
  return { ...a, cookie };
}
async function join(page: Page, title: string) {
  await button(page, "Available").click();
  await button(page, `View ${title}`).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Join challenge", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Join challenge", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Leave challenge", exact: true }),
  ).toBeVisible();
}
async function dismiss(page: Page) {
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "Achievement unlocked" });
  if (await alert.count())
    await alert.getByRole("button", { name: "Dismiss", exact: true }).click();
}
test("supporter enrollment, leave, private confirmations, medal pinning and activity Log integration", async ({
  page,
}) => {
  const a = await fixture(page);
  try {
    await page.goto(a.base + "/explore");
    await button(page, "Explore Challenges").click();
    await expect(
      page.getByText("Challenges", { exact: true }).last(),
    ).toBeVisible();
    expect(
      await page
        .getByRole("tablist", { name: "Primary navigation" })
        .getByRole("tab")
        .count(),
    ).toBe(5);
    await join(page, "Spread Awareness");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Leave challenge", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await join(page, "Spread Awareness");
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm completion", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("switch", {
        name: "I took part in an awareness activity",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm completion", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      page.getByRole("alert").filter({ hasText: "Achievement unlocked" }),
    ).toBeVisible();
    await dismiss(page);
    await button(page, "View Spread Awareness").click();
    await expect(
      page.getByText("Self-reported completion", { exact: true }),
    ).toBeVisible();
    await button(page, "View associated medal").click();
    await expect(
      page.getByRole("dialog", { name: "Awareness", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Pin to profile", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Unpin from profile", exact: true }),
    ).toBeVisible();
    expect(
      (await a.call("GET", "/api/achievements", { cookie: a.cookie })).json
        .awards[0].visibility,
    ).toBe("private");
    await page.goto(a.base + "/challenges");
    await join(page, "Get Moving");
    await button(page, "Use activity Log instead").click();
    await button(page, "Save").click();
    await expect
      .poll(
        async () =>
          (
            (await a.call("GET", "/api/challenges", { cookie: a.cookie })).json
              .participations as { challengeId: string; status: string }[]
          ).find((x) => x.challengeId === "activity_of_choice")?.status,
      )
      .toBe("completed");
    await page.goto(a.base + "/challenges");
    await join(page, "Make a Connection");
    await page
      .getByRole("switch", {
        name: "I joined an existing community",
        exact: true,
      })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm completion", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("switch", { name: "I had a meaningful exchange", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm completion", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await dismiss(page);
    await join(page, "Celebrate a Milestone");
    await page
      .getByRole("switch", {
        name: "I marked a personal milestone",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm completion", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await dismiss(page);
    const result = (
      await a.call("GET", "/api/challenges", { cookie: a.cookie })
    ).json.participations;
    expect(
      result.filter((p: { status: string }) => p.status === "completed"),
    ).toHaveLength(4);
    expect(
      result.every((p: { visibility: string }) => p.visibility === "private"),
    ).toBe(true);
    await page.reload();
    await button(page, "Completed").click();
    await expect(button(page, "View Celebrate a Milestone")).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "Achievement unlocked" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        (id) => localStorage.getItem("gluca-demo-v1")!.includes(id),
        result[0].enrollmentId,
      ),
    ).toBe(false);
    await page.goto(a.base + "/account");
    await button(page, "Sign out").click();
    await page.goto(a.base + "/challenges");
    await button(page, "Completed").click();
    await expect(
      page.getByText("No completed challenges", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Sign in to join challenges/)).toBeVisible();
  } finally {
    await a.close();
  }
});
test("Share a Moment uses confirmed Create-to-feed publication without requiring glucose", async ({
  page,
}) => {
  const a = await fixture(page);
  try {
    await page.goto(a.base + "/challenges");
    await join(page, "Share a Moment");
    await button(page, "Create a moment").click();
    await expect(
      page.getByRole("switch", { name: "Also post to Gluca" }),
    ).not.toBeChecked();
    await page.getByRole("switch", { name: "Also post to Gluca" }).click();
    await button(page, "Export & Post").click();
    let d = page.waitForEvent("download");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm Export & Post", exact: true })
      .click();
    await d;
    await expect(button(page, "View published post")).toBeVisible();
    expect(
      (await a.call("GET", "/api/challenges", { cookie: a.cookie })).json
        .participations[0].status,
    ).toBe("joined");
    await button(page, "Public").click();
    await button(page, "Export & Post").click();
    d = page.waitForEvent("download");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm Export & Post", exact: true })
      .click();
    await d;
    await expect(button(page, "View published post")).toBeVisible();
    await expect
      .poll(
        async () =>
          (await a.call("GET", "/api/challenges", { cookie: a.cookie })).json
            .participations[0].status,
      )
      .toBe("completed");
    await expect(
      page.getByRole("alert").filter({ hasText: "Achievement unlocked" }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "Home", exact: true }).click();
    await expect(page.getByTestId("published-graphic").first()).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "Achievement unlocked" }),
    ).toBeVisible();
    await dismiss(page);
    await button(page, "Discover Challenges").click();
    await button(page, "Completed").click();
    await button(page, "View Share a Moment").click();
    await expect(
      page.getByText("Verified public post", { exact: true }),
    ).toBeVisible();
    const awards = (
      await a.call("GET", "/api/achievements", { cookie: a.cookie })
    ).json.awards;
    expect(
      awards.filter(
        (a: { achievementId: string }) => a.achievementId === "first_post",
      ),
    ).toHaveLength(1);
  } finally {
    await a.close();
  }
});
test("mobile and desktop challenge catalog is accessible in light and dark modes", async ({
  page,
}) => {
  const a = await fixture(page);
  try {
    await mkdir("docs/screenshots/stage8b", { recursive: true });
    for (const dark of [false, true])
      for (const width of [375, 430, 1280]) {
        await page.addInitScript(
          (dark) =>
            localStorage.setItem(
              "gluca-demo-v1",
              JSON.stringify({ seenWelcome: true, dark }),
            ),
          dark,
        );
        await page.setViewportSize({ width, height: 900 });
        await page.goto(a.base + "/challenges");
        await expect(
          page.getByText("Challenges", { exact: true }).last(),
        ).toHaveCSS("color", dark ? "rgb(245, 248, 246)" : "rgb(19, 33, 25)");
        await expect(button(page, "View Share a Moment")).toBeVisible();
        await page.screenshot({
          path: `docs/screenshots/stage8b/catalog-${width}-${dark ? "dark" : "light"}.png`,
          animations: "disabled",
        });
        await button(
          page,
          "View Celebrate a Milestone",
        ).scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `docs/screenshots/stage8b/catalog-bottom-${width}-${dark ? "dark" : "light"}.png`,
          animations: "disabled",
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await button(page, "View Celebrate a Milestone").click();
        await expect(
          page
            .getByRole("dialog")
            .getByRole("button", { name: "Close challenge", exact: true }),
        ).toBeInViewport();
        await page.screenshot({
          path: `docs/screenshots/stage8b/details-${width}-${dark ? "dark" : "light"}.png`,
          animations: "disabled",
        });
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Close challenge", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toBeHidden();
      }
    expect(
      (await a.call("GET", "/api/challenges", { cookie: a.cookie })).json
        .participations,
    ).toHaveLength(0);
    expect(
      (await a.call("GET", "/api/achievements", { cookie: a.cookie })).json
        .awards,
    ).toHaveLength(0);
  } finally {
    await a.close();
  }
});
