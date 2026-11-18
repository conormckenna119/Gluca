import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { photoFixture } from "./png-proof";
const before = process.env.STAGE7C_BEFORE === "1";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "gluca-demo-v1",
      JSON.stringify({ seenWelcome: true }),
    );
    localStorage.setItem(
      "gluca-dev-flags",
      "identity,accounts,dexcomApi,dexcomDiagnostics=false,dexcomSync=false",
    );
  });
});
test("audit real screens, responsive navigation, typography and modal behavior", async ({
  page,
}) => {
  await mkdir("docs/screenshots/stage7c", { recursive: true });
  const findings: unknown[] = [];
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
      await page.setViewportSize({ width, height: 800 });
      for (const [route, title] of [
        ["/", "Home"],
        ["/glucose", "My Glucose"],
        ["/create", "Create"],
        ["/explore", "Explore"],
        ["/profile", "Profile"],
        ["/onboarding", "Make yourself at home"],
        ["/profile-edit", "Edit profile"],
        ["/settings", "Settings & privacy"],
        ["/account", "Account"],
        ["/identity-preview", "Identity preview"],
        ["/post/seed-0", "Conversation"],
      ]) {
        await page.goto(route);
        await expect(
          page.getByRole("heading", { name: title, exact: true }).first(),
        ).toBeVisible();
        await page.screenshot({
          animations: "disabled",
          path: `docs/screenshots/stage7c/${before ? "before" : "after"}-${route.replace(/\W/g, "") || "home"}-${width}-${dark ? "dark" : "light"}.png`,
        });
        findings.push({
          route,
          width,
          dark,
          ...(await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth,
            fonts: [...document.querySelectorAll('h1,[role="heading"],input')]
              .slice(0, 3)
              .map((e) => ({
                font: getComputedStyle(e).fontFamily,
                height: e.getBoundingClientRect().height,
              })),
          }))),
        });
        const bar = page.getByRole("tablist", { name: "Primary navigation" });
        if (route !== "/account") await expect(bar).toBeVisible();
        else
          await expect(
            page.getByRole("button", { name: "Close", exact: true }),
          ).toBeVisible();
      }
    }
  }
  await page.goto("/create");
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  // RN Web activates Escape/focus handling after the opening animation's onShow.
  await expect(
    page.getByRole("dialog", { name: "Customize", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Done", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  findings.push({
    modal: await page.evaluate(() => ({
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      active: document.activeElement?.getAttribute("aria-label"),
    })),
  });
  await page.getByRole("button", { name: "Done", exact: true }).press("Escape");
  await expect(
    page.getByRole("button", { name: "Done", exact: true }),
  ).not.toBeVisible();
  findings.push({ escapeCloses: true });
  await writeFile(
    `docs/screenshots/stage7c/${before ? "before" : "after"}-observations.json`,
    JSON.stringify(findings, null, 2),
  );
});

test("phone overlay selection exits by tap or Escape without changing the composition", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/create");
  await page.getByRole("button", { name: "Demo data", exact: true }).click();
  await page
    .getByRole("button", { name: "Transparent overlay", exact: true })
    .click();
  const target = page.getByLabel("Select glucose overlay", { exact: true });
  await target.click();
  const selected = page.getByLabel(
    "Move glucose overlay. Arrow keys move; Shift moves faster.",
    { exact: true },
  );
  await expect(selected).toHaveCSS("touch-action", "none");
  const preview = page
    .getByLabel(/^Preview of your graphic/)
    .filter({ visible: true });
  const transform = await preview
    .locator("svg > g")
    .first()
    .getAttribute("transform");
  await selected.click();
  await expect(target).toHaveCSS("touch-action", "pan-y");
  await expect(preview.locator("svg > g").first()).toHaveAttribute(
    "transform",
    transform!,
  );
  await target.click();
  await selected.press("Escape");
  await expect(target).toHaveCSS("touch-action", "pan-y");
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Profile", exact: true }),
  ).toBeVisible();
});
test("photo picker shows pending state and ignores a result from an unmounted template context", async ({
  page,
}, info) => {
  await page.goto("/create");
  await page
    .getByRole("button", { name: "Transparent overlay", exact: true })
    .click();
  const photo = info.outputPath("synthetic.png");
  await writeFile(photo, photoFixture(64, 48, [20, 40, 80]));
  const waiting = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Add a photo behind it", exact: true })
    .click();
  const chooser = await waiting;
  await expect(
    page.getByRole("button", { name: "Opening photos…", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    animations: "disabled",
    path: "docs/screenshots/stage7c/photo-pending.png",
  });
  await page.getByRole("button", { name: "Daily recap", exact: true }).click();
  await chooser.setFiles(photo);
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Transparent overlay", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add a photo behind it", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Change photo", exact: true }),
  ).toHaveCount(0);
});
test("shared sheets have names, retain Escape and fit a short keyboard-sized viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 500 });
  await page.goto("/create");
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Customize", exact: true });
  await expect(dialog).toBeVisible();
  const done = dialog.getByRole("button", { name: "Done", exact: true });
  await expect(done).toBeInViewport({ ratio: 1 });
  await dialog
    .getByRole("textbox", { name: "Headline", exact: true })
    .fill("Synthetic recap");
  await page.screenshot({
    animations: "disabled",
    path: "docs/screenshots/stage7c/sheet-375-short.png",
  });
  await done.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Primary navigation" }),
  ).toBeVisible();
});

test("review auxiliary existing routes and period insights without changing production flags", async ({
  page,
}) => {
  await mkdir("docs/screenshots/stage7c", { recursive: true });
  for (const dark of [false, true]) {
    await page.addInitScript((dark) => {
      localStorage.setItem(
        "gluca-demo-v1",
        JSON.stringify({ seenWelcome: true, dark }),
      );
      localStorage.setItem(
        "gluca-dev-flags",
        "identity,accounts,eventLogging,achievements,dexcomApi,dexcomDiagnostics,dexcomSync=false",
      );
    }, dark);
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const [route, title] of [
        ["/import", "Import & export"],
        ["/welcome", "Create your glucose story."],
        ["/log", "Log something"],
        ["/trophies", "Trophy Cabinet"],
        ["/dexcom-data", "Dexcom data viewer"],
      ]) {
        await page.goto(route);
        await expect(
          page.getByRole("heading", { name: title, exact: true }).first(),
        ).toBeVisible();
        await page.screenshot({
          animations: "disabled",
          path: `docs/screenshots/stage7c/aux-${route.slice(1)}-${width}-${dark ? "dark" : "light"}.png`,
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await page.goto("/glucose");
      await page
        .getByText("This period", { exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        animations: "disabled",
        path: `docs/screenshots/stage7c/period-insights-${width}-${dark ? "dark" : "light"}.png`,
      });
    }
  }
});
