import { test, expect, type Page } from "@playwright/test";
import { writeFile, readFile } from "node:fs/promises";
import { photoFixture, pngProof } from "./png-proof";
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
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).filter({ visible: true });
async function addPhoto(page: Page, label: string, file: string) {
  const waiting = page.waitForEvent("filechooser");
  await button(page, label).click();
  await (await waiting).setFiles(file);
  await expect(button(page, "Change photo")).toBeVisible();
}
async function exported(page: Page) {
  const event = page.waitForEvent("download");
  await button(page, "Export Graphic").click();
  const file = await (await event).path();
  expect(file).not.toBeNull();
  return pngProof(await readFile(file!));
}
test("photo overlay survives add/replace/remove/template switches and exports with correct alpha and dimensions", async ({
  page,
}, info) => {
  const a = info.outputPath("opaque-a.png"),
    b = info.outputPath("opaque-b.png");
  await writeFile(a, photoFixture(64, 48, [20, 40, 80]));
  await writeFile(b, photoFixture(48, 64, [70, 30, 50]));
  await page.goto("/create");
  await button(page, "Transparent overlay").click();
  const preview = page
    .getByRole("img", { name: /^Preview of your graphic/ })
    .filter({ visible: true });
  await expect(preview).toBeVisible();
  const original = (await preview.getAttribute("aria-label"))!;
  const noPhoto = await exported(page);
  expect([noPhoto.width, noPhoto.height]).toEqual([1080, 1920]);
  expect(noPhoto.transparent).toBeGreaterThan(noPhoto.pixels / 2);
  expect(noPhoto.white).toBeGreaterThan(1000);
  await addPhoto(page, "Add a photo behind it", a);
  await expect
    .poll(async () => pngProof(await preview.screenshot()).white)
    .toBeGreaterThan(50);
  expect(await preview.getAttribute("aria-label")).toContain(
    original.replace("Background: transparent (no photo, no colour). ", ""),
  );
  let proof = await exported(page);
  expect([proof.width, proof.height]).toEqual([1080, 1920]);
  expect(proof.transparent).toBe(0);
  expect(proof.white).toBeGreaterThan(1000);
  await addPhoto(page, "Change photo", b);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page
    .getByText("Edit profile", { exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  await expect(button(page, "Change photo")).toBeVisible();
  await expect(button(page, "Transparent: on")).toBeVisible();
  await expect
    .poll(async () => pngProof(await preview.screenshot()).white)
    .toBeGreaterThan(50);
  await button(page, "Daily recap").click();
  await expect(button(page, "Transparent: off")).toBeVisible();
  await button(page, "Transparent overlay").click();
  await expect(button(page, "Change photo")).toBeVisible();
  for (const [format, height] of [
    ["Portrait", 1350],
    ["Square", 1080],
  ] as const) {
    await button(page, format).click();
    proof = await exported(page);
    expect([proof.width, proof.height]).toEqual([1080, height]);
    expect(proof.transparent).toBe(0);
    expect(proof.white).toBeGreaterThan(1000);
  }
  await button(page, "Remove photo").click();
  await expect(button(page, "Add a photo behind it")).toBeVisible();
  proof = await exported(page);
  expect([proof.width, proof.height]).toEqual([1080, 1080]);
  expect(proof.transparent).toBeGreaterThan(proof.pixels / 2);
});
test("persistent shell survives direct links, transitions, scrolling, resized viewport and focused input", async ({
  page,
}) => {
  for (const width of [375, 430, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of [
      "/",
      "/explore",
      "/create",
      "/glucose",
      "/profile",
      "/profile-edit",
      "/post/seed-0",
      "/settings",
      "/onboarding",
    ]) {
      await page.goto(route);
      const bar = page.getByRole("tablist", { name: "Primary navigation" });
      await expect(bar).toBeVisible();
      await expect(bar.getByRole("tab")).toHaveCount(5);
      const rect = await bar.boundingBox();
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(801);
      expect(rect!.y + rect!.height).toBeGreaterThanOrEqual(799);
      await page.mouse.wheel(0, 3000);
      await expect(bar).toBeVisible();
      await bar.getByRole("tab", { name: "Create", exact: true }).click();
      await expect(page).toHaveURL(/\/create$/);
    }
  }
  await page.goto("/profile-edit");
  await page
    .getByRole("textbox", { name: "Display name", exact: true })
    .fill("Synthetic draft only");
  await page.setViewportSize({ width: 375, height: 430 });
  await expect(
    page.getByRole("tablist", { name: "Primary navigation" }),
  ).toBeVisible();
  await page.goto("/account");
  await expect(
    page.getByRole("tablist", { name: "Primary navigation" }),
  ).toHaveCount(0);
  await button(page, "Close").click();
  await expect(page).toHaveURL(/\/create$/);
});
