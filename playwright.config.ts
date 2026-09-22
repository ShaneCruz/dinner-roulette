import { defineConfig, devices } from "@playwright/test";

// End-to-end smoke tests against the local dev server (`npm run dev`),
// which uses the developer sign-in. Run with `npm run test:e2e`.
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3100/sign-in",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
