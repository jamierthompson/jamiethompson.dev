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
  },
});
