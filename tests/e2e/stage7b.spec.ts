import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const before = process.env.STAGE7B_BEFORE === "1";
const button = (p: Page, name: string) =>
  p.getByRole("button", { name, exact: true }).filter({ visible: true });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "gluca-demo-v1",
      JSON.stringify({ seenWelcome: true }),
    );
    localStorage.setItem(
      "gluca-dev-flags",
      "identity,accounts,dexcomApi=false,dexcomDiagnostics=false,dexcomSync=false",
    );
  });
});
test("identity visual matrix at compact sizes and in both themes", async ({
  page,
}) => {
  await mkdir("docs/screenshots/stage7b", { recursive: true });
  for (const dark of [false, true]) {
    await page.addInitScript(
      (dark) =>
        localStorage.setItem(
          "gluca-demo-v1",
          JSON.stringify({ seenWelcome: true, dark }),
        ),
      dark,
    );
    for (const width of before ? [375, 1280] : [375, 430, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/identity-preview");
      await expect(
        page.getByText("Identity preview", { exact: true }),
      ).toBeVisible();
      for (const section of ["Sizes", "Emblems", "Names in a feed"]) {
        await page.getByText(section, { exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `docs/screenshots/stage7b/${before ? "before" : "after"}-${section.split(" ")[0].toLowerCase()}-${width}-${dark ? "dark" : "light"}.png`,
        });
      }
      if (!before) {
        await page
          .getByRole("button", {
            name: /^Years with diabetes, bronze shield style, 9 years, limited date precision/,
          })
          .click();
        await expect(
          page.getByText("Color · bronze", { exact: true }),
        ).toBeVisible();
        await expect(button(page, "Done")).toBeInViewport({ ratio: 1 });
        await page.screenshot({
          animations: "disabled",
          path: `docs/screenshots/stage7b/detail-${width}-${dark ? "dark" : "light"}.png`,
        });
        await button(page, "Done").click();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test("clean shield geometry, compact names and private precision details", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/identity-preview");
  const shields = page.getByRole("img", { name: /^Years with diabetes,/ });
  await expect(shields.first()).toBeVisible();
  expect(await shields.count()).toBeGreaterThanOrEqual(60);
  for (const shield of await shields.all()) {
    const rendered = await shield.evaluate((el) => ({
      paths: el.querySelectorAll("path").length,
      ornaments: el.querySelectorAll("circle,rect,defs,linearGradient").length,
      text: el.querySelector("svg")?.textContent ?? "",
    }));
    expect(rendered.paths).toBe(1);
    expect(rendered.ornaments).toBe(0);
    expect(rendered.text).toMatch(/^\d*$/);
  }
  for (const style of [
    "teal",
    "silver",
    "bronze",
    "gold",
    "amethyst",
    "sapphire",
    "emerald",
    "platinum",
    "diamond",
    "legacy",
  ]) {
    const box = (await page
      .getByRole("img", {
        name: new RegExp(`^Years with diabetes, ${style} shield style`),
      })
      .first()
      .boundingBox())!;
    expect(box.width).toBe(56);
    expect(box.height).toBeCloseTo((56 * 56) / 48, 0);
  }
  const limited = page.getByRole("button", {
    name: /^Years with diabetes, bronze shield style, 9 years, limited date precision/,
  });
  const hit = (await limited.boundingBox())!;
  expect(hit.width).toBeGreaterThanOrEqual(44);
  expect(hit.height).toBeGreaterThanOrEqual(44);
  await limited.click();
  await expect(
    page.getByText("At least 9 years with diabetes", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Color · bronze", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/The diagnosis date is partial or estimated/),
  ).toBeVisible();
  await expect(page.getByText(/Next anniversary:/)).toHaveCount(0);
  await expect(button(page, "Done")).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    animations: "disabled",
    path: "docs/screenshots/stage7b/precision-detail-375.png",
  });
  await button(page, "Done").click();
  for (const name of ["Supporter", "Caregiver", "Advocate"]) {
    await page
      .getByRole("button", {
        name: `${name}. Opens an explanation.`,
        exact: true,
      })
      .first()
      .click();
    await expect(
      page.getByText(name, { exact: true }).filter({ visible: true }).last(),
    ).toBeVisible();
    await expect(
      page
        .getByText(/does not share anyone's glucose data/)
        .filter({ visible: true })
        .last(),
    ).toBeVisible();
    await button(page, "Done").click();
  }
  const line = page
    .getByTestId("identity-name-line")
    .filter({ hasText: "Alexandra With A Long Community Name" });
  const box = (await line.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(335);
  expect(
    await line.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
});

async function onboard(
  page: Page,
  role: string,
  date?: { year: string; month?: string; day?: string },
) {
  await page.goto("/onboarding");
  await button(page, role).click();
  await button(page, "Continue").click();
  if (date) {
    await page
      .getByRole("textbox", { name: "Year", exact: true })
      .fill(date.year);
    if (date.month)
      await page
        .getByRole("textbox", { name: "Month (optional)", exact: true })
        .fill(date.month);
    if (date.day)
      await page
        .getByRole("textbox", { name: "Day (optional)", exact: true })
        .fill(date.day);
    await page
      .getByRole("switch", { name: "Show my shield publicly", exact: true })
      .check();
    await page.screenshot({
      path: "docs/screenshots/stage7b/onboarding-date.png",
    });
    await button(page, "Continue").click();
  }
  await button(page, "Skip this step").click();
  await page
    .getByRole("textbox", { name: "Display name", exact: true })
    .fill("Casey With A Long Fictional Display Name");
  await page
    .getByRole("textbox", { name: "Public username (optional)", exact: true })
    .fill("casey_shield_preview_member");
  if (!date)
    await page
      .getByRole("switch", { name: "Show my emblem", exact: true })
      .check();
  await button(page, "Continue").click();
  await button(page, "Finish setup").click();
  await expect(
    page.getByText("Your profile is ready.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your profile is ready.", { exact: true }),
  ).not.toBeVisible();
}
test("profile date precision, privacy switches and compact public header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const dark of [false, true]) {
    await page.addInitScript(
      (dark) =>
        localStorage.setItem(
          "gluca-demo-v1",
          JSON.stringify({ seenWelcome: true, dark }),
        ),
      dark,
    );
    for (const date of [
      { year: "2000", month: "2", day: "29" },
      { year: "2000", month: "2" },
      { year: "2000" },
    ]) {
      await onboard(page, "I live with Type 1 diabetes.", date);
      const header = page
        .getByTestId("user-identity")
        .filter({ visible: true })
        .first();
      await expect(
        header.getByRole("img", { name: /^Years with diabetes,/ }),
      ).toBeVisible();
      expect(
        await header.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: `docs/screenshots/stage7b/profile-${date.day ? "exact" : date.month ? "month" : "year"}-375.png`,
      });
      for (const width of [375, 430, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        await expect(
          header.getByRole("img", { name: /^Years with diabetes,/ }),
        ).toBeVisible();
        expect(
          await header.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
        await page.screenshot({
          path: `docs/screenshots/stage7b/header-${date.day ? "exact" : date.month ? "month" : "year"}-${width}-${dark ? "dark" : "light"}.png`,
        });
      }
      await page.setViewportSize({ width: 375, height: 800 });
      await button(page, "View your shield details").click();
      if (date.day)
        await expect(
          page
            .getByText(/Next anniversary:/)
            .filter({ visible: true })
            .last(),
        ).toBeVisible();
      else
        await expect(
          page
            .getByText(/Only a diagnosis (month|year)|Only a diagnosis month/)
            .filter({ visible: true })
            .last(),
        ).toBeVisible();
      await button(page, "Done").click();
      await button(page, "Edit profile").click();
      await page
        .getByRole("switch", { name: "Show my shield", exact: true })
        .uncheck();
      await expect(
        page
          .getByTestId("user-identity")
          .first()
          .getByRole("img", { name: /^Years with diabetes,/ }),
      ).toHaveCount(0);
      await page.getByRole("tab", { name: "Profile", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Profile", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Your profile is ready.", { exact: true }),
      ).not.toBeVisible();
      await expect(
        page
          .getByTestId("user-identity")
          .filter({ visible: true })
          .first()
          .getByRole("img", { name: /^Years with diabetes,/ }),
      ).toHaveCount(0);
    }
  }
});
test("supporter caregiver and advocate onboarding use the shared non-numeric emblems", async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 800 });
  for (const [role, name] of [
    ["I'm a friend or family supporter.", "Supporter"],
    ["I'm a caregiver.", "Caregiver"],
    ["I'm interested in diabetes awareness.", "Advocate"],
  ]) {
    await onboard(page, role);
    const header = page
      .getByTestId("user-identity")
      .filter({ visible: true })
      .first();
    await expect(
      header.getByRole("img", { name: new RegExp(`^${name} emblem`) }),
    ).toBeVisible();
    await expect(
      header.getByRole("img", { name: /^Years with diabetes,/ }),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: `${name}. Opens an explanation.`,
        exact: true,
      })
      .filter({ visible: true })
      .first()
      .click();
    await expect(button(page, "Done")).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/stage7b/${name.toLowerCase()}-detail-430.png`,
    });
    await button(page, "Done").click();
  }
});

test("shared identities render in feed, comments, community and following displays", async ({
  page,
}) => {
  for (const dark of [false, true]) {
    await page.addInitScript(
      (dark) =>
        localStorage.setItem(
          "gluca-demo-v1",
          JSON.stringify({ seenWelcome: true, dark }),
        ),
      dark,
    );
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await onboard(page, "I live with Type 1 diabetes.", { year: "2000" });
      await page.getByRole("tab", { name: "Home", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Home", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Alex Morgan", { exact: true }).first(),
      ).toBeVisible();
      expect(
        await page
          .getByText("Alex Morgan", { exact: true })
          .first()
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        animations: "disabled",
        path: `docs/screenshots/stage7b/feed-${width}-${dark ? "dark" : "light"}.png`,
      });
      await page
        .getByRole("button", { name: /^Comments,/ })
        .first()
        .click();
      await page
        .getByRole("textbox", { name: "Your comment", exact: true })
        .fill("Fictional test comment");
      await button(page, "Add comment").click();
      await expect(
        page.getByText("Fictional test comment", { exact: true }),
      ).toBeVisible();
      const commentIdentity = page
        .getByText("Fictional test comment", { exact: true })
        .locator("..")
        .getByTestId("user-identity");
      await expect(
        commentIdentity.getByRole("img", { name: /^Years with diabetes,/ }),
      ).toBeVisible();
      await page.screenshot({
        path: `docs/screenshots/stage7b/comments-${width}-${dark ? "dark" : "light"}.png`,
      });
      await page.getByRole("tab", { name: "Explore", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Explore", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "Your comment", exact: true }),
      ).not.toBeVisible();
      const fictional = page.getByRole("button", {
        name: "Explore fictional demo",
        exact: true,
      });
      if (await fictional.count()) await fictional.click();
      // Existing people list remains explicitly fictional.
      await expect(
        page.getByTestId("user-identity").filter({ visible: true }).first(),
      ).toBeVisible();
      await page.getByText("People", { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `docs/screenshots/stage7b/community-${width}-${dark ? "dark" : "light"}.png`,
      });
      const follow = page
        .getByRole("button", { name: /^Follow / })
        .filter({ visible: true })
        .first();
      if (await follow.count()) await follow.click();
      await page.getByRole("tab", { name: "Profile", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Profile", exact: true }),
      ).toBeVisible();
      await page
        .getByText("Your existing local demo connections.", { exact: true })
        .filter({ visible: true })
        .last()
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `docs/screenshots/stage7b/following-${width}-${dark ? "dark" : "light"}.png`,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});
