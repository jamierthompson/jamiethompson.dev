import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:4321",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4321/",
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    // astro preview daemonizes when it detects an agent-driven terminal,
    // which Playwright reads as the server exiting early. This is the var
    // the daemon sets on its own child to keep the server in-process, so
    // setting it here makes preview run foreground under Playwright.
    env: { ASTRO_PREVIEW_BACKGROUND: "1" },
  },
});
