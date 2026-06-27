import { defineConfig, devices } from "@playwright/test";

// Accessibility harness — runs axe against the public site. By default it boots a
// local production build (what ships). Set A11Y_BASE_URL to scan a DEPLOYED URL
// instead (skips the local server) — e.g. the Amplify URL or the live domain.
// Kept separate from the vitest unit suite (*.test.ts); these are *.spec.ts under
// e2e/. See e2e/README.md.
const remoteBase = process.env.A11Y_BASE_URL;
const PORT = 3100;
const baseURL = remoteBase ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Safari's engine, scoped to the nav interaction specs — that's where engine
    // differences bite (backdrop-filter containing blocks, position:fixed,
    // safe-area, AVIF). The broad axe route scan stays on chromium (engine-agnostic).
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testMatch: /nav-menu\.spec\.ts/ },
  ],
  // Only boot a local server when scanning localhost; a deployed URL is already up.
  ...(remoteBase
    ? {}
    : {
        webServer: {
          command: `npm run build && npx next start -p ${PORT}`,
          url: `http://127.0.0.1:${PORT}`,
          timeout: 180_000,
          reuseExistingServer: !process.env.CI,
          // Open the staff dashboard for scanning: force demo mode (Clerk off) so
          // the middleware takes the open-demo branch. Mirrors CI, where no Clerk
          // secrets are set. Never used against a deployed URL (that path is gated).
          env: {
            ...process.env,
            ALLOW_OPEN_DASHBOARD: "true",
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
            CLERK_SECRET_KEY: "",
          },
        },
      }),
});
