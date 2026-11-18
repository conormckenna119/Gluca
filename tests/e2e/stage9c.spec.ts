import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { startApp } from "../../server/testkit";
import { defaultProfile, defaultPrivacy } from "../../src/domain/profile";
import { photoFixture } from "./png-proof";
const before = process.env.STAGE9C_BEFORE === "1";
async function fixture(page: Page) {
  const a = await startApp({ serveWeb: true, webRoot: path.resolve("dist") });
  a.app.deps.config.appBaseUrl = a.base;
  const cookie = await a.login(),
    headers = { "X-Gluca-Request": "1" };
  await a.call("POST", "/api/profile", {
    cookie,
    headers,
    body: {
      profile: {
        ...defaultProfile(),
        displayName: "Casey Morgan",
        username: "fictional-casey",
        bio: "Fictional design test account. Running, photography and everyday life.",
        role: "living",
        diabetesType: "type1",
        diagnosis: { year: 2006, month: 4, day: 12 },
        cgm: { brand: "dexcom", model: "G7" },
        onboarded: true,
      },
      privacy: {
        ...defaultPrivacy(),
        showShield: true,
        showShieldNumber: true,
      },
      revision: 0,
    },
  });
  await a.call("POST", "/api/posts", {
    cookie,
    headers,
    body: {
      requestId: "fictional-design-post-001",
      visibility: "public",
      title: "Daily recap",
      caption: "Fictional design fixture — not a real health record.",
      alt: "Synthetic image for aspect-ratio testing",
      image: `data:image/png;base64,${photoFixture(1080, 1350, [60, 92, 78]).toString("base64")}`,
    },
  });
  const [name, value] = cookie.split("=");
  await page.context().addCookies([{ name, value, url: a.base }]);
  await page.addInitScript(() => {
    localStorage.setItem(
      "gluca-demo-v1",
      JSON.stringify({ seenWelcome: true }),
    );
    localStorage.setItem(
      "gluca-dev-flags",
      "identity,accounts,achievements,communityChallenges,eventLogging,dexcomApi,dexcomSync=false,dexcomDiagnostics=false",
    );
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  return { ...a, cookie };
}
const ROUTES = [
  ["feed", "/"],
  ["glucose", "/glucose"],
  ["create", "/create"],
  ["community", "/explore"],
  ["profile", "/profile"],
  ["trophies", "/trophies"],
  ["challenges", "/challenges"],
  ["settings", "/settings"],
  ["onboarding", "/onboarding"],
  ["profile-edit", "/profile-edit"],
] as const;
test("design baseline and responsive visual matrix", async ({ page }) => {
  test.setTimeout(300000);
  const a = await fixture(page),
    dir = `docs/screenshots/stage9c/${before ? "before" : "after"}`;
  const metrics: unknown[] = [];
  try {
    await mkdir(dir, { recursive: true });
    for (const dark of [false, true]) {
      await page.addInitScript(
        (dark) =>
          localStorage.setItem(
            "gluca-demo-v1",
            JSON.stringify({ seenWelcome: true, dark }),
          ),
        dark,
      );
      for (const width of before
        ? [393, 1280]
        : [320, 375, 393, 430, 768, 1280]) {
        // This fixture uses a frozen backend clock. Advance its request-limit window
        // between viewport groups rather than weakening production throttles for 120 reloads.
        a.clock.now += 16 * 60 * 1000;
        await page.setViewportSize({ width, height: 900 });
        for (const [name, url] of ROUTES) {
          await page.goto(a.base + url);
          await expect(
            page.getByRole("tablist", { name: "Primary navigation" }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading").filter({ visible: true }).first(),
          ).toBeVisible();
          // Allow profile and settings repositories to replace their loading frame before capturing.
          if (name === "profile")
            await expect(
              page
                .getByText("Casey Morgan", { exact: true })
                .filter({ visible: true })
                .first(),
            ).toBeVisible();
          if (name === "settings")
            await expect(
              page.getByText("Dexcom sandbox", { exact: true }).first(),
            ).toBeVisible();
          if (name === "trophies") {
            await expect(
              page.getByRole("button", { name: /First Post medal, earned/ }),
            ).toBeVisible();
            await expect(
              page.getByText(/Medal update could not be saved/),
            ).toHaveCount(0);
          }
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          );
          if (!before) expect(overflow, `${name} at ${width}`).toBe(false);
          if (name === "feed") {
            const logo = page.locator('svg[aria-label="Gluca"]').first();
            const bounds = await logo.evaluate((node) => {
              const svg = node as SVGSVGElement,
                b = svg.getBBox(),
                v = svg.viewBox.baseVal;
              return {
                box: { x: b.x, y: b.y, width: b.width, height: b.height },
                viewBox: { x: v.x, y: v.y, width: v.width, height: v.height },
                contained:
                  b.x >= v.x &&
                  b.y >= v.y &&
                  b.x + b.width <= v.x + v.width &&
                  b.y + b.height <= v.y + v.height,
              };
            });
            metrics.push({ name, width, dark, overflow, logo: bounds });
            if (!before) expect(bounds.contained).toBe(true);
            if (!before) {
              const header = await page
                  .getByTestId("brand-header")
                  .boundingBox(),
                svg = await logo.boundingBox();
              expect(svg!.y).toBeGreaterThanOrEqual(header!.y);
              expect(svg!.y + svg!.height).toBeLessThanOrEqual(
                header!.y + header!.height + 1,
              );
              const nav = await page
                .getByRole("tablist", { name: "Primary navigation" })
                .boundingBox();
              expect(nav!.x).toBeGreaterThanOrEqual(8);
              expect(nav!.x + nav!.width).toBeLessThanOrEqual(width - 8);
              for (const tab of await page
                .getByRole("tablist", { name: "Primary navigation" })
                .getByRole("tab")
                .all())
                expect(
                  (await tab.boundingBox())!.height,
                ).toBeGreaterThanOrEqual(44);
            }
          }
          await page.screenshot({
            path: `${dir}/${name}-${width}-${dark ? "dark" : "light"}.png`,
          });
          if (!before && name === "glucose") {
            await page
              .locator("svg")
              .filter({ has: page.locator("text") })
              .first()
              .scrollIntoViewIfNeeded();
            await page.screenshot({
              path: `${dir}/chart-${width}-${dark ? "dark" : "light"}.png`,
            });
            await page
              .getByText("This period", { exact: true })
              .scrollIntoViewIfNeeded();
            await page.screenshot({
              path: `${dir}/insights-${width}-${dark ? "dark" : "light"}.png`,
            });
          }
        }
      }
    }
    await writeFile(`${dir}/metrics.json`, JSON.stringify(metrics, null, 2));
  } finally {
    await a.close();
  }
});

test("profile section links, privacy-safe share fallback, shield sheet and keyboard-sized navigation", async ({
  page,
}) => {
  test.skip(before);
  const a = await fixture(page);
  try {
    // Stub the device clipboard only: exercise the UI/URL payload without replacing the owner's OS clipboard.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as unknown as { profileLink: string }).profileLink = text;
          },
        },
      });
    });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(a.base + "/profile");
    const share = page.getByRole("button", {
      name: "Share profile",
      exact: true,
    });
    await expect(share).toBeEnabled();
    await share.click();
    await expect(
      page.getByText("Profile link copied. Viewing requires a Gluca account.", {
        exact: true,
      }),
    ).toBeVisible();
    const link = await page.evaluate(
      () => (window as unknown as { profileLink: string }).profileLink,
    );
    expect(link).toBe(a.base + "/profile?username=fictional-casey");
    expect(link).not.toMatch(/2006|G7|type1|diagnosis/);
    await page.getByRole("button", { name: "Posts", exact: true }).click();
    await expect(
      page.getByText("Your posts", { exact: true }),
    ).toBeInViewport();
    // Return to the section links before jumping to the private More content.
    await page.goto(a.base + "/profile");
    await expect(share).toBeEnabled();
    await page.getByRole("button", { name: "More", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "View saved public profile",
        exact: true,
      }),
    ).toBeInViewport();
    await page
      .getByRole("button", { name: "View your shield details", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/stage9c/after/shield-detail-320.png",
    });
    await page.keyboard.press("Escape");
    await page.goto(a.base + "/profile-edit");
    await page.setViewportSize({ width: 320, height: 440 });
    await page
      .getByRole("textbox", { name: "Display name", exact: true })
      .focus();
    const nav = page.getByRole("tablist", { name: "Primary navigation" });
    await expect(nav).toBeInViewport({ ratio: 1 });
    const save = page.getByRole("button", {
      name: "Save profile and privacy",
      exact: true,
    });
    await save.scrollIntoViewIfNeeded();
    const buttonBox = await save.boundingBox(),
      navBox = await nav.boundingBox();
    expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(navBox!.y);
    await page.screenshot({
      path: "docs/screenshots/stage9c/after/keyboard-sized-profile-edit-320.png",
    });
  } finally {
    await a.close();
  }
});
