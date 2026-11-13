import { test, expect } from "@playwright/test";
test("demo social, glucose, transparent export, publishing and persistence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("A walk before work", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kudos 3", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Kudos 4", exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Comments 0", exact: true })
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
  await expect(page.getByText(/estimated time in range/).first()).toBeVisible();
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
