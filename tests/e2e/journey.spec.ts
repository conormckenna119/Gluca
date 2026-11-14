import { test, expect } from "@playwright/test";
test("welcome, demo graphic, export, then demo social, glucose, transparent export, publishing and persistence", async ({
  page,
}, testInfo) => {
  // Fresh context: no saved state, so the first run lands on the welcome screen, not the feed.
  await page.goto("/");
  const demo = page.getByRole("button", { name: "Try demo data", exact: true });
  await expect(demo).toBeVisible();
  await expect(page).toHaveURL(/\/welcome$/);
  const t0 = Date.now();
  await demo.click();
  await expect(page.getByRole("img", { name: /Preview of your graphic/ })).toBeVisible();
  const firstGraphicMs = Date.now() - t0;
  console.log(`fresh install: welcome visible to graphic visible = ${firstGraphicMs} ms`);
  testInfo.annotations.push({ type: "welcome-to-graphic-ms", description: String(firstGraphicMs) });
  expect(firstGraphicMs).toBeLessThan(30000);
  // Export the default graphic straight from Create.
  const firstDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG / Share", exact: true }).click();
  expect((await firstDownload).suggestedFilename()).toBe("gluca-daily-recap-story.png");
  await expect(page.getByText(/Nothing was posted/).first()).toBeVisible();
  // Welcome is not shown again once it has been used.
  await page.goto("/");
  await expect(page).not.toHaveURL(/welcome/);
  await expect(
    page.getByText("A walk before work", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Give kudos, 3", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove kudos, 4", exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Comments, 0", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Your comment", { exact: true })
    .fill("A supportive demo comment");
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await expect(
    page.getByText("A supportive demo comment", { exact: true }),
  ).toBeVisible();
  await page.goto("/glucose");
  await page
    .getByLabel("Date (YYYY-MM-DD, local day)", { exact: true })
    .fill("2026-11-11");
  await page.getByRole("button", { name: "6 hours", exact: true }).click();
  await expect(page.getByText("Time in range", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "Create a graphic", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Transparent overlay", exact: true })
    .click();
  await expect(page.getByText(/transparent PNG/).first()).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export PNG / Share", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "gluca-transparent-overlay-transparent-story.png",
  );
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(path!);
  expect(buffer.readUInt32BE(16)).toBe(1080);
  expect(buffer.readUInt32BE(20)).toBe(1920);
  expect(buffer[25]).toBe(6); // PNG colour type 6 = RGBA, so the transparent overlay keeps its alpha channel
  await page
    .getByLabel("Post caption", { exact: true })
    .fill("My end-to-end demo moment");
  await page.getByRole("button", { name: "Preview post", exact: true }).click();
  await page
    .getByRole("button", { name: "Publish to local feed", exact: true })
    .click();
  await expect(
    page.getByText("My end-to-end demo moment", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("My end-to-end demo moment", { exact: true }),
  ).toBeVisible();
});
