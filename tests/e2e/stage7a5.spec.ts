import { test, expect, type Page } from "@playwright/test";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { photoFixture, pngProof } from "./png-proof";
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
  await page.goto("/create");
  await button(page, "Demo data").click();
  await button(page, "Transparent overlay").click();
});
test("drag, corner resize, sliders, keyboard, reset and scene persistence", async ({
  page,
}, info) => {
  await button(page, "Edit overlay").click();
  const target = page.getByLabel(
    "Move glucose overlay. Arrow keys move; Shift moves faster.",
    { exact: true },
  );
  const preview = page
    .getByLabel(/^Preview of your graphic/)
    .filter({ visible: true });
  const group = preview.locator("svg > g").first();
  await expect(group).toHaveAttribute("transform", "translate(0 0) scale(1)");
  await target.scrollIntoViewIfNeeded();
  let b = (await target.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.55, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(group).not.toHaveAttribute(
    "transform",
    "translate(0 0) scale(1)",
  );
  await page
    .getByRole("slider", { name: "Overlay size", exact: true })
    .fill("70");
  await page
    .getByRole("slider", { name: "Overlay opacity", exact: true })
    .fill("60");
  await expect(group).toHaveAttribute("opacity", "0.6");
  await target.scrollIntoViewIfNeeded();
  const handle = target.locator('div[data-resize="true"]').last();
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + 22, hb.y + 22);
  await page.mouse.down();
  await page.mouse.move(hb.x + 10, hb.y + 10, { steps: 6 });
  await page.mouse.up();
  expect(
    Number(
      await page
        .getByRole("slider", { name: "Overlay size", exact: true })
        .inputValue(),
    ),
  ).toBeLessThan(70);
  await target.press("ArrowLeft");
  const placement = await group.getAttribute("transform");
  const a = info.outputPath("photo-a.png"),
    bfile = info.outputPath("photo-b.png");
  await writeFile(a, photoFixture(64, 48, [20, 40, 80]));
  await writeFile(bfile, photoFixture(64, 48, [80, 40, 20]));
  for (const [label, file] of [
    ["Add a photo behind it", a],
    ["Change photo", bfile],
  ]) {
    const chooser = page.waitForEvent("filechooser");
    await button(page, label).click();
    await (await chooser).setFiles(file);
    await expect(button(page, "Change photo")).toBeVisible();
    await expect(group).toHaveAttribute("transform", placement!);
  }
  await button(page, "Previous day").click();
  await expect(group).toHaveAttribute("transform", placement!);
  await button(page, "Daily recap").click();
  await button(page, "Transparent overlay").click();
  await expect(group).toHaveAttribute("transform", placement!);
  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  await expect(group).toHaveAttribute("transform", placement!);
  await mkdir("docs/screenshots/stage7a5", { recursive: true });
  await preview.screenshot({
    path: "docs/screenshots/stage7a5/photo-preview.png",
  });
  for (const [format, height] of [
    ["Story", 1920],
    ["Portrait", 1350],
    ["Square", 1080],
  ] as const) {
    await button(page, format).click();
    const download = page.waitForEvent("download");
    await button(page, "Export Graphic").click();
    const bytes = await readFile((await (await download).path())!);
    await writeFile(
      `docs/screenshots/stage7a5/photo-${format.toLowerCase()}.png`,
      bytes,
    );
    const proof = pngProof(bytes);
    expect([proof.width, proof.height]).toEqual([1080, height]);
    expect(proof.transparent).toBe(0);
  }
  await button(page, "Remove photo").click();
  const download = page.waitForEvent("download");
  await button(page, "Export Graphic").click();
  const transparent = await readFile((await (await download).path())!);
  await writeFile(
    "docs/screenshots/stage7a5/transparent-square.png",
    transparent,
  );
  const proof = pngProof(transparent);
  expect(proof.transparent).toBeGreaterThan(proof.pixels / 2);
  await button(page, "Reset layout").click();
  await expect(group).toHaveAttribute("transform", "translate(0 0) scale(1)");
  await expect(group).toHaveAttribute("opacity", "1");
});
test("responsive overlay editor stays within the viewport in both themes", async ({
  page,
}, info) => {
  await mkdir("docs/screenshots/stage7a5", { recursive: true });
  const photo = info.outputPath("responsive-photo.png");
  await writeFile(photo, photoFixture(64, 48, [20, 40, 80]));
  for (const dark of [false, true]) {
    await page.addInitScript(
      (dark) =>
        localStorage.setItem(
          "gluca-demo-v1",
          JSON.stringify({ seenWelcome: true, dark }),
        ),
      dark,
    );
    await page.goto("/create");
    await button(page, "Demo data").click();
    await button(page, "Transparent overlay").click();
    const chooser = page.waitForEvent("filechooser");
    await button(page, "Add a photo behind it").click();
    await (await chooser).setFiles(photo);
    await button(page, "Edit overlay").click();
    await page
      .getByRole("slider", { name: "Overlay size", exact: true })
      .fill("75");
    await page
      .getByRole("slider", { name: "Overlay opacity", exact: true })
      .fill("80");
    for (const width of [375, 430, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const selected = page.getByLabel(
        "Move glucose overlay. Arrow keys move; Shift moves faster.",
        { exact: true },
      );
      await selected.scrollIntoViewIfNeeded();
      const b = (await selected.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole("tablist", { name: "Primary navigation" }),
      ).toBeVisible();
      await page.screenshot({
        path: `docs/screenshots/stage7a5/editor-${width}-${dark ? "dark" : "light"}.png`,
      });
      await page
        .getByRole("slider", { name: "Overlay size", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `docs/screenshots/stage7a5/controls-${width}-${dark ? "dark" : "light"}.png`,
      });
    }
  }
});
test("touch pinch scales the foreground, and unselected canvas permits scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 900 });
  const target = page.getByLabel("Select glucose overlay", { exact: true });
  await expect(target).toHaveCSS("touch-action", "pan-y");
  await button(page, "Edit overlay").click();
  const selected = page.getByLabel(
    "Move glucose overlay. Arrow keys move; Shift moves faster.",
    { exact: true },
  );
  await selected.scrollIntoViewIfNeeded();
  const b = (await selected.boundingBox())!,
    x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 50, y, id: 1 },
      { x: x + 50, y, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: x - 30, y, id: 1 },
      { x: x + 30, y, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(
    page.getByRole("slider", { name: "Overlay size", exact: true }),
  ).toHaveValue("60");
  await button(page, "Done positioning").click();
  await expect(target).toHaveCSS("touch-action", "pan-y");
});
test("caption tones are optional, editable and removable without fallback slogans", async ({
  page,
}) => {
  await button(page, "Customize").click();
  for (const name of [
    "Minimal",
    "Casual",
    "Humorous",
    "Motivational",
    "Custom",
  ])
    await expect(button(page, name)).toBeVisible();
  await button(page, "Casual").click();
  await expect(
    page.getByRole("textbox", { name: "Graphic caption", exact: true }),
  ).toHaveValue("A look at my day.");
  await page
    .getByRole("textbox", { name: "Graphic caption", exact: true })
    .fill("My own caption");
  await button(page, "Done").click();
  await button(page, "The real side").click();
  await button(page, "Customize").click();
  await expect(
    page.getByRole("textbox", { name: "Graphic caption", exact: true }),
  ).toHaveValue("My own caption");
  await button(page, "Remove headline and caption").click();
  await button(page, "Done").click();
  await expect(
    page.getByLabel(/^Preview of your graphic/).filter({ visible: true }),
  ).not.toHaveAttribute("aria-label", /Some days|showing up|My own caption/);
});
