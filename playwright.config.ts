import { defineConfig, devices } from "@playwright/test";

/** E2E runs against the production static export (`npm run build` first). */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // Every test runs a WebGL map; more parallel pages than this starve each other on ordinary machines.
  workers: process.env.CI ? 2 : 3,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3210", trace: "retain-on-failure" },
  webServer: {
    command: "npx serve out -l 3210 --no-clipboard",
    url: "http://localhost:3210/az/",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 800 },
        // Use the real GPU when there is one, so frame pacing is meaningful.
        launchOptions: { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
      },
    },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
