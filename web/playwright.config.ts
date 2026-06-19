import { defineConfig, devices } from "@playwright/test";

// Accessibility harness — runs axe against the public site. It boots a production
// build (what actually ships) and is kept separate from the vitest unit suite
// (which owns *.test.ts; these are *.spec.ts under e2e/). See e2e/README.md.
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
