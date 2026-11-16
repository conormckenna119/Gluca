import { defineConfig } from "@playwright/test";
// Run after exporting with EXPO_PUBLIC_FLAGS=dexcomApi. This test owns its ephemeral mock backend.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "dexcom-oauth.spec.ts",
  timeout: 90000,
  workers: 1,
  use: { channel: "msedge", viewport: { width: 390, height: 844 } },
  reporter: "list",
});
