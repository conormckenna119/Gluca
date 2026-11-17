import { defineConfig } from "@playwright/test";
// Explicit MOCK browser workflow. Export a development web bundle with both Dexcom flags first.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "dexcom-create.spec.ts",
  timeout: 90000,
  workers: 1,
  use: { channel: "msedge", viewport: { width: 390, height: 844 } },
  reporter: "list",
});
