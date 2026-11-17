import { test, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FAKE, startApp, tokenOk } from "../../server/testkit";
test("MOCK PASS: authenticated Dexcom provider → historical Create preview → actual PNG export", async ({
  page,
}) => {
  const start = Date.parse("2025-01-01T00:00:00Z");
  const records = Array.from({ length: 288 }, (_, i) => ({
    recordId: `synthetic-${i}`,
    systemTime: new Date(start + i * 300000).toISOString(),
    unit: "mg/dL",
    value: 100,
    trend: "flat",
    displayApp: "G7",
    displayDevice: "iOS",
    transmitterGeneration: "g7",
  }));
  const a = await startApp(
    { diagnosticsEnabled: true, serveWeb: true, webRoot: path.resolve("dist") },
    (url) =>
      url.includes("/token")
        ? tokenOk()
        : new Response(
            JSON.stringify(
              url.includes("/dataRange")
                ? {
                    recordType: "dataRange",
                    recordVersion: "3.0",
                    userId: "synthetic",
                    egvs: {
                      start: { systemTime: "2025-01-01T00:00:00" },
                      end: { systemTime: "2025-01-02T12:00:00" },
                    },
                  }
                : {
                    recordType: "egv",
                    recordVersion: "3.0",
                    userId: "synthetic",
                    records,
                  },
            ),
          ),
  );
  try {
    const cookie = await a.login();
    const begin = await a.call("POST", "/api/dexcom/connect", {
      cookie,
      headers: { "X-Gluca-Request": "1" },
    });
    const state = new URL(begin.json.authorizationUrl).searchParams.get(
      "state",
    );
    expect(
      (
        await a.call(
          "GET",
          `/api/dexcom/callback?state=${state}&code=${FAKE.code}`,
          { cookie },
        )
      ).status,
    ).toBe(302);
    const split = cookie.indexOf("=");
    await page
      .context()
      .addCookies([
        {
          name: cookie.slice(0, split),
          value: cookie.slice(split + 1),
          url: a.base,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    await page.setExtraHTTPHeaders({ Origin: FAKE.appBase });
    await page.addInitScript(() =>
      localStorage.setItem(
        "gluca-demo-v1",
        JSON.stringify({
          seenWelcome: true,
          unit: "mg/dL",
          range: { low: 70, high: 180 },
        }),
      ),
    );
    await page.goto(a.base + "/create");
    await page
      .getByRole("button", { name: "Dexcom Sandbox", exact: true })
      .click();
    await expect(
      page.getByLabel("Historical date (UTC, YYYY-MM-DD)", { exact: true }),
    ).toHaveValue("2025-01-01");
    await expect(
      page.getByText("288 Dexcom readings loaded", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByLabel(
        /Preview of your graphic.*Dexcom sandbox.*100%.*100 mg\/dL.*288/,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Preview post", exact: true }),
    ).toHaveCount(0);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: "Export PNG / Share", exact: true })
        .click(),
    ]);
    const filename = await download.path();
    expect(filename).toBeTruthy();
    const png = await readFile(filename!);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1920);
    await mkdir(".dexcom-verification", { recursive: true });
    await writeFile(".dexcom-verification/mock-browser-story.png", png);
    await expect(
      page.getByText("Saved a 1080×1920 PNG. Nothing was posted.", {
        exact: true,
      }),
    ).toBeVisible();
    const privateState = await page.evaluate(() =>
      localStorage.getItem("gluca-demo-v1"),
    );
    expect(privateState).not.toContain("synthetic-");
    expect(privateState).not.toContain("sourceSystemTime");
    expect(
      a.calls.some((c) => c.url.includes("/v3/users/self/egvs")),
    ).toBeTruthy();
  } finally {
    await a.close();
  }
});
