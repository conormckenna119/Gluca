import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { startApp } from "../../server/testkit";
import { defaultProfile, defaultPrivacy } from "../../src/domain/profile";
import { photoFixture, pngProof } from "./png-proof";
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
        displayName: "Fictional story tester",
        username: "fictional-publisher",
        role: "living",
        diagnosis: { year: 2006, month: 4, day: 12 },
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
  return { ...a, cookie };
}
test("real export-to-feed PNG: explicit opt-in, photo/alpha, lost-response retry, privacy and unlock feedback", async ({
  page,
}, info) => {
  const a = await fixture(page);
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(a.base + "/create");
    await expect(
      page.getByRole("switch", { name: "Also post to Gluca" }),
    ).not.toBeChecked();
    await expect(
      page.getByText("What’s on this image", { exact: true }),
    ).toHaveCount(0);
    let downloads = 0;
    page.on("download", () => downloads++);
    let d = page.waitForEvent("download");
    await button(page, "Export Graphic").click();
    await d;
    expect(
      (await a.call("GET", "/api/posts", { cookie: a.cookie })).json.posts,
    ).toHaveLength(0);
    await expect(
      page.getByRole("alert").filter({ hasText: "Achievement unlocked" }),
    ).toHaveCount(0);
    await button(page, "Transparent overlay").click();
    await expect(button(page, "Move left")).toHaveCount(0);
    await button(page, "Alternative positioning controls").click();
    await expect(button(page, "Move left")).toBeVisible();
    await button(page, "Hide alternative positioning").click();
    await page
      .getByRole("slider", { name: "Overlay opacity", exact: true })
      .fill("65");
    const photo = info.outputPath("fictional-photo.png");
    await writeFile(photo, photoFixture(64, 48, [45, 70, 100]));
    const chooser = page.waitForEvent("filechooser");
    await button(page, "Add a photo behind it").click();
    await (await chooser).setFiles(photo);
    await expect(button(page, "Change photo")).toBeVisible();
    await page.getByRole("switch", { name: "Also post to Gluca" }).click();
    await page
      .getByLabel("Post caption (optional)", { exact: true })
      .fill("Fictional photo recap");
    await expect(button(page, "followers")).toHaveCount(0);
    await button(page, "Public").click();
    await button(page, "Export & Post").click();
    await expect(
      page.getByRole("dialog", { name: "Confirm Gluca post" }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(
      (await a.call("GET", "/api/posts", { cookie: a.cookie })).json.posts,
    ).toHaveLength(0);
    let lost = false;
    await page.route("**/api/posts", async (route) => {
      if (route.request().method() === "POST" && !lost) {
        lost = true;
        const r = await route.fetch();
        expect(r.status()).toBe(200);
        await route.abort("failed");
      } else await route.continue();
    });
    await button(page, "Export & Post").click();
    d = page.waitForEvent("download");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm Export & Post", exact: true })
      .click();
    const exported = await readFile((await (await d).path())!);
    expect(pngProof(exported).transparent).toBe(0);
    await expect(button(page, "Retry publishing")).toBeVisible();
    await expect(
      page.getByText(/Graphic exported. Posting was not confirmed/),
    ).toBeVisible();
    expect(
      (await a.call("GET", "/api/posts", { cookie: a.cookie })).json.posts,
    ).toHaveLength(1);
    await button(page, "Retry publishing").click();
    await expect(button(page, "View published post")).toBeVisible();
    expect(downloads).toBe(2);
    const posts = (await a.call("GET", "/api/posts", { cookie: a.cookie })).json
      .posts;
    expect(posts).toHaveLength(1);
    expect(posts[0].visibility).toBe("public");
    const media = Buffer.from(
      await (
        await fetch(a.base + posts[0].media.uri, {
          headers: { Cookie: a.cookie },
        })
      ).arrayBuffer(),
    );
    expect(media.equals(exported)).toBe(true);
    await button(page, "View published post").click();
    await expect(
      page
        .getByText("Fictional photo recap", { exact: true })
        .filter({ visible: true })
        .last(),
    ).toBeVisible();
    const image = page
      .getByTestId("published-graphic")
      .filter({ visible: true });
    await expect(image).toBeVisible();
    const box = (await image.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(1080 / 1920, 2);
    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Achievement unlocked" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByRole("button", { name: "View Achievement", exact: true }),
    ).toBeVisible();
    await alert
      .getByRole("button", { name: "View Achievement", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.goto(a.base + "/");
    await expect(
      page
        .getByText("Fictional photo recap", { exact: true })
        .filter({ visible: true })
        .last(),
    ).toBeVisible();
    await page.reload();
    await expect(
      page
        .getByText("Fictional photo recap", { exact: true })
        .filter({ visible: true })
        .last(),
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "Achievement unlocked" }),
    ).toHaveCount(0);
    await mkdir("docs/screenshots/stage8a5", { recursive: true });
    for (const dark of [false, true])
      for (const width of [375, 430, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((dark) => {
          localStorage.setItem(
            "gluca-demo-v1",
            JSON.stringify({ seenWelcome: true, dark }),
          );
        }, dark);
        await page.goto(a.base + `/post/${posts[0].id}`);
        await expect(
          page
            .getByText("Fictional photo recap", { exact: true })
            .filter({ visible: true })
            .last(),
        ).toBeVisible();
        await page.getByTestId("published-graphic").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `docs/screenshots/stage8a5/post-${width}-${dark ? "dark" : "light"}.png`,
          animations: "disabled",
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    // A second, private transparent export retains real alpha and no default caption.
    await page.goto(a.base + "/create");
    await button(page, "Transparent overlay").click();
    await page.getByRole("switch", { name: "Also post to Gluca" }).click();
    await button(page, "Export & Post").click();
    d = page.waitForEvent("download");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm Export & Post", exact: true })
      .click();
    const transparent = await readFile((await (await d).path())!);
    expect(pngProof(transparent).transparent).toBeGreaterThan(1000);
    await expect(button(page, "View published post")).toBeVisible();
    const saved = (await a.call("GET", "/api/posts", { cookie: a.cookie })).json
      .posts;
    expect(saved).toHaveLength(2);
    expect(
      saved.some(
        (p: { visibility: string; caption: string }) =>
          p.visibility === "private" && p.caption === "",
      ),
    ).toBe(true);
  } finally {
    await a.close();
  }
});
test("shield details keep precision private and expose optional color progression", async ({
  page,
}) => {
  const a = await fixture(page);
  try {
    await page.goto(a.base + "/profile");
    await button(page, "View your shield details").click();
    await expect(
      page.getByRole("dialog", { name: "Years with diabetes" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Colors mark different spans of time/),
    ).toBeVisible();
    await button(page, "Explore shield colors").click();
    await expect(
      page.getByText("sapphire · 20–24 years", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await expect(page.getByText(/sapphire shield style/i)).toHaveCount(0);
  } finally {
    await a.close();
  }
});

test("export failure sends no post; upload failure retries once with an unchanged image", async ({
  page,
}) => {
  const a = await fixture(page);
  try {
    await page.goto(a.base + "/create");
    await page.getByRole("switch", { name: "Also post to Gluca" }).click();
    await page.evaluate(() => {
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        callback(null);
      };
    });
    await button(page, "Export & Post").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm Export & Post", exact: true })
      .click();
    await expect(
      page.getByText("PNG export failed.", { exact: true }),
    ).toBeVisible();
    expect(
      (await a.call("GET", "/api/posts", { cookie: a.cookie })).json.posts,
    ).toHaveLength(0);
    await expect(button(page, "Retry publishing")).toHaveCount(0);
    await page.reload();
    await page.getByRole("switch", { name: "Also post to Gluca" }).click();
    let fail = true;
    await page.route("**/api/posts", async (route) => {
      if (route.request().method() === "POST" && fail) {
        fail = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "synthetic_upload_failure" }),
        });
      } else await route.continue();
    });
    await button(page, "Export & Post").click();
    const d = page.waitForEvent("download");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm Export & Post", exact: true })
      .click();
    await d;
    await expect(button(page, "Retry publishing")).toBeVisible();
    expect(
      (await a.call("GET", "/api/posts", { cookie: a.cookie })).json.posts,
    ).toHaveLength(0);
    await button(page, "Retry publishing").evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });
    await expect(button(page, "View published post")).toBeVisible();
    expect(
      (await a.call("GET", "/api/posts", { cookie: a.cookie })).json.posts,
    ).toHaveLength(1);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("gluca-demo-v1")!).posts.filter(
              (p: { remote?: boolean }) => p.remote,
            ).length,
        ),
      )
      .toBe(0);
  } finally {
    await a.close();
  }
});
