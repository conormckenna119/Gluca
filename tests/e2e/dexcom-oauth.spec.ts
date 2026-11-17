import { test, expect } from "@playwright/test";
import { startApp, tokenOk, FAKE } from "../../server/testkit";
import path from "node:path";
import { mkdir } from "node:fs/promises";
test("mock sandbox OAuth browser journey, isolation, rotation and responsive connection controls", async ({
  page,
}) => {
  let revoked = false;
  const a = await startApp(
    { serveWeb: true, webRoot: path.resolve("dist") },
    (_url, init) => {
      const refresh =
        new URLSearchParams(String(init?.body)).get("grant_type") ===
        "refresh_token";
      if (refresh && revoked) return new Response("{}", { status: 400 });
      return refresh
        ? new Response(
            JSON.stringify({
              access_token: "mock-rotated-access",
              refresh_token: "mock-rotated-refresh",
              token_type: "Bearer",
              expires_in: 7200,
            }),
          )
        : tokenOk();
    },
  );
  // The test's ephemeral listening port is selected by the OS, not a guessed deployment hostname.
  a.app.deps.config.appBaseUrl = a.base;
  a.app.deps.config.redirectUri = `${a.base}/api/dexcom/callback`;
  try {
    await page.route(
      "https://sandbox-api.dexcom.com/v3/oauth2/login?**",
      async (route) => {
        const url = new URL(route.request().url());
        expect(url.searchParams.get("scope")).toBe("offline_access");
        const callback = new URL(a.app.deps.config.redirectUri);
        callback.searchParams.set("state", url.searchParams.get("state")!);
        callback.searchParams.set("code", "mock-browser-code");
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: `<h1>Mock Dexcom Sandbox Consent</h1><a href="${callback.href.replace(/&/g, "&amp;")}">Authorize simulated account</a>`,
        });
      },
    );
    // This fixture owns authorization only; its backend intentionally has no glucose diagnostics.
    await page.addInitScript(() =>
      localStorage.setItem(
        "gluca-dev-flags",
        "dexcomApi,dexcomDiagnostics=false,dexcomSync=false,identity=false,accounts=false",
      ),
    );
    await page.goto(a.base);
    await page
      .getByRole("button", { name: "Try demo data", exact: true })
      .click();
    await page.goto(`${a.base}/settings`);
    await page
      .getByLabel("Gluca sandbox username", { exact: true })
      .fill("browser-test-account");
    await page
      .getByLabel("Gluca sandbox passphrase", { exact: true })
      .fill("synthetic-browser-passphrase");
    await page
      .getByRole("button", {
        name: "Create Gluca sandbox account",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Connect Dexcom", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Connect Dexcom", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Mock Dexcom Sandbox Consent",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Authorize simulated account", exact: true })
      .click();
    await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    a.clock.now += 7200000;
    await page
      .getByRole("button", { name: "Check connection", exact: true })
      .click();
    await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    // Connected was already visible before the refresh request finished.
    await expect.poll(() => a.calls.length).toBe(2);
    const leaked = await page.evaluate(
      ({ access, refresh }) =>
        Object.values(localStorage).some(
          (text) =>
            String(text).includes(access) || String(text).includes(refresh),
        ),
      { access: FAKE.access, refresh: FAKE.refresh },
    );
    expect(leaked).toBe(false);
    await mkdir("docs/screenshots/stage2", { recursive: true });
    for (const width of [375, 430, 1280]) {
      await page.setViewportSize({ width, height: 950 });
      for (const dark of [true, false]) {
        const toggle = page.getByRole("button", {
          name: dark ? "Use dark theme" : "Use light theme",
          exact: true,
        });
        if (await toggle.isVisible()) await toggle.click();
        await expect(
          page.getByText("Connected", { exact: true }),
        ).toBeVisible();
        await page
          .getByText("Connected", { exact: true })
          .scrollIntoViewIfNeeded();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `docs/screenshots/stage2/connection-${width}-${dark ? "dark" : "light"}.png`,
        });
      }
    }
    revoked = true;
    a.clock.now += 7200000;
    await page
      .getByRole("button", { name: "Check connection", exact: true })
      .click();
    await expect(page.getByText("Reconnect", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Disconnect Dexcom", exact: true })
      .click();
    await expect(page.getByText("Disconnected", { exact: true })).toBeVisible();
    expect(
      a.app.deps.db.prepare("SELECT COUNT(*) AS n FROM egvs").get()?.n,
    ).toBe(0);
    expect(a.calls.every((c) => c.url.endsWith("/v3/oauth2/token"))).toBe(true);
  } finally {
    await a.close();
  }
});
