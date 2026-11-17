import { defineConfig } from "@playwright/test";
// Set E2E_BASE_URL to test against a server on another port (it must already be running).
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:8081";
export default defineConfig({
  testDir: "./tests/e2e",
  // OAuth owns an isolated mock backend and requires its dedicated flag-on export/config.
  testIgnore: ["**/dexcom-oauth.spec.ts", "**/dexcom-create.spec.ts"],
  // The journey covers the whole app in one test and takes 20 to 25 s on a warm server.
  timeout: 90000,
  use: {
    channel: "msedge",
    baseURL,
    viewport: { width: 390, height: 844 },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run web -- --port 8081",
        url: "http://localhost:8081",
        reuseExistingServer: true,
        timeout: 120000,
      },
  reporter: "list",
});
