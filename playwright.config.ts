import { defineConfig, devices } from "@playwright/test";

/** Not Astro's default 4321 — that port belongs to the dev server. */
const PREVIEW_PORT = 4331;

export default defineConfig({
  testDir: "e2e",
  // Restores the generated content files the fixture build overwrote.
  globalTeardown: "./e2e/global-teardown.ts",
  // A committed `test.only` would otherwise let CI pass while silently
  // running a single test.
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // No `--` separator: npm strips it before forwarding, pnpm passes it
    // through literally and `astro preview -- --port` is not a valid command.
    command: `pnpm run preview --port ${PREVIEW_PORT}`,
    url: `http://localhost:${PREVIEW_PORT}/`,
    timeout: 120 * 1000,
    // Playwright only ever probes `url` above, so nothing here can reach the
    // backgrounded dev server on 4321 — the port move alone does that. What
    // this buys is a loud failure when something already holds 4331 (a stale
    // `astro preview` from a crashed run, say) instead of silently testing it:
    // reuse is the only alternative to the error at runner/index.js:848-851.
    reuseExistingServer: false,
    // astro preview daemonizes when it detects an agent-driven terminal,
    // which Playwright reads as the server exiting early. This is the var
    // the daemon sets on its own child to keep the server in-process, so
    // setting it here makes preview run foreground under Playwright.
    env: { ASTRO_PREVIEW_BACKGROUND: "1" },
  },
});
