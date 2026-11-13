import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    channel: "msedge",
    baseURL: "http://localhost:8081",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "npm run web -- --port 8081",
    url: "http://localhost:8081",
    reuseExistingServer: true,
    timeout: 120000,
  },
  reporter: "list",
});
