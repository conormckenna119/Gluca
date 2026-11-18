import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import { startApp } from "../../server/testkit";
import { defaultProfile, defaultPrivacy } from "../../src/domain/profile";
import { pngProof } from "./png-proof";
const button = (p: Page, name: string) =>
  p.getByRole("button", { name, exact: true }).filter({ visible: true });
test("fictional account cabinet: confirmation, export award, pin order, privacy, reload and responsive light/dark", async ({
  page,
  context,
}) => {
  const a = await startApp({ serveWeb: true, webRoot: path.resolve("dist") });
  a.app.deps.config.appBaseUrl = a.base;
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const cookie = await a.login(),
      [name, value] = cookie.split("=");
    await context.addCookies([{ name, value, url: a.base }]);
    const headers = { "X-Gluca-Request": "1" };
    await a.call("POST", "/api/profile", {
      cookie,
      headers,
      body: {
        profile: {
          ...defaultProfile(),
          displayName: "Fictional cabinet tester",
          username: "fictional-medals",
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
        "identity,accounts,achievements,dexcomApi=false,dexcomDiagnostics=false,dexcomSync=false",
      );
    });
    await page.goto(`${a.base}/trophies`);
    await expect(
      page.getByText("No medals yet", { exact: true }),
    ).toBeVisible();
    // Real application export, using synthetic demo readings, not a seeded first-story award.
    await page.goto(`${a.base}/create`);
    const download = page.waitForEvent("download");
    await button(page, "Export Graphic").click();
    const proof = pngProof(await readFile((await (await download).path())!));
    expect([proof.width, proof.height]).toEqual([1080, 1920]);
    await expect
      .poll(
        async () =>
          (await a.call("GET", "/api/achievements", { cookie })).json.awards
            .length,
      )
      .toBe(1);
    await page.goto(`${a.base}/trophies`);
    // Confirmed, optional activities reuse the existing confirmation sheet.
    await button(page, "Mark as done").first().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Mark as done", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      page.getByRole("button", { name: /Awareness medal, earned/ }),
    ).toBeVisible();
    await button(page, "Mark as done").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Mark as done", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      page.getByRole("button", { name: /Personal Milestone medal, earned/ }),
    ).toBeVisible();
    for (const title of ["First Story", "Awareness", "Personal Milestone"]) {
      await page
        .getByRole("button", { name: new RegExp(`^${title} medal, earned`) })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Pin to profile", exact: true })
        .click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Unpin from profile", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /^Close / })
        .last()
        .click();
      await expect(page.getByRole("dialog")).toBeHidden();
    }
    await button(page, "Arrange pinned medals").click();
    await button(page, "Move Personal Milestone earlier").click();
    await expect
      .poll(async () =>
        (
          (await a.call("GET", "/api/achievements", { cookie })).json
            .awards as { achievementId: string; pinned: boolean }[]
        )
          .filter((x) => x.pinned)
          .map((x) => x.achievementId),
      )
      .toEqual(["first_story", "personal_milestone", "awareness_contribution"]);
    await page.reload();
    await expect(
      page.getByRole("button", { name: /First Story medal, earned.*pinned/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /First Story medal, earned/ })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("switch", { name: /Show on my profile/ })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Close / })
      .last()
      .click();
    expect(
      (
        await a.call("GET", "/api/profiles/public?username=fictional-medals", {
          cookie,
        })
      ).json.medals,
    ).toBeUndefined();
    await page.getByRole("switch", { name: /Public collection/ }).click();
    await expect
      .poll(
        async () =>
          (
            await a.call(
              "GET",
              "/api/profiles/public?username=fictional-medals",
              { cookie },
            )
          ).json.medals?.length,
      )
      .toBe(1);
    await mkdir("docs/screenshots/stage8a", { recursive: true });
    for (const dark of [false, true])
      for (const width of [375, 430, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((dark) => {
          const s = JSON.parse(localStorage.getItem("gluca-demo-v1")!);
          localStorage.setItem("gluca-demo-v1", JSON.stringify({ ...s, dark }));
        }, dark);
        await page.reload();
        await expect(
          page.getByText("Trophy Cabinet", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("Trophy Cabinet", { exact: true }),
        ).toHaveCSS("color", dark ? "rgb(245, 248, 246)" : "rgb(19, 33, 25)");
        await expect(
          page.getByRole("button", { name: /First Story medal, earned/ }),
        ).toBeVisible();
        await page.screenshot({
          path: `docs/screenshots/stage8a/cabinet-${width}-${dark ? "dark" : "light"}.png`,
          animations: "disabled",
        });
        await page
          .getByRole("button", { name: /First Story medal, earned/ })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Share", exact: true })
          .scrollIntoViewIfNeeded();
        await expect(
          page
            .getByRole("dialog")
            .getByRole("button", { name: /^Close / })
            .last(),
        ).toBeInViewport();
        await page.screenshot({
          path: `docs/screenshots/stage8a/detail-${width}-${dark ? "dark" : "light"}.png`,
          animations: "disabled",
        });
        await page
          .getByRole("dialog")
          .getByRole("button", { name: /^Close / })
          .last()
          .click();
        await expect(page.getByRole("dialog")).toBeHidden();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    await page.goto(`${a.base}/profile?username=fictional-medals`);
    await expect(
      page.getByRole("button", { name: /First Story medal, 2027/ }),
    ).toBeVisible();
    await page.goto(`${a.base}/profile`);
    await expect(button(page, "Trophy Cabinet")).toBeVisible();
    // Logout invalidates server ownership; fresh guest must not receive this account's medals.
    await page.goto(`${a.base}/account`);
    await button(page, "Sign out").click();
    await page.goto(`${a.base}/trophies`);
    await expect(
      page.getByText("No medals yet", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Guest collection/)).toBeVisible();
    await expect(
      page.getByRole("switch", { name: /Public collection/ }),
    ).toHaveCount(0);
  } finally {
    await a.close();
  }
});
