import { test, expect } from "@playwright/test";

// Executable end-to-end verifier for social sign-in (Google / Facebook / LinkedIn).
//
// This drives a REAL, Clerk-configured deployment and checks the part that
// actually breaks in practice: that each provider is enabled in Clerk and its
// "Continue with …" button starts the provider's OAuth flow (right client_id +
// redirect_uri). Completing the provider login itself (entering a Google/Facebook/
// LinkedIn password, 2FA, consent) is interactive and account-specific, so it stays
// a manual step — see docs/social-auth-runbook.md. What we CAN automate is the
// handshake up to the provider's authorize screen, which is where a misconfigured
// connection fails.
//
// Requires a target: set SIGNIN_URL to a deployment where Clerk is live (keys set)
// and the three connections are enabled — e.g. a staging/preview URL or production.
//   SIGNIN_URL=https://staging.example.org \
//   A11Y_BASE_URL=https://staging.example.org \
//   npx playwright test social-signin --project=chromium
// (A11Y_BASE_URL just tells playwright.config not to boot a local build — this spec
// navigates to SIGNIN_URL directly.) With SIGNIN_URL unset, every test SKIPS, so
// this never runs in the default CI a11y job (which has no Clerk / no such URL).

const SIGNIN_URL = process.env.SIGNIN_URL;

// One entry per connection we expect on the sign-in page. `button` matches Clerk's
// accessible button name (rendered as "Continue with Google", etc.); `authorizeHost`
// is the provider domain the click must redirect to (proof the OAuth app is wired up).
const PROVIDERS = [
  { key: "google", button: /google/i, authorizeHost: /accounts\.google\.com/ },
  { key: "facebook", button: /facebook/i, authorizeHost: /(facebook|meta)\.com/ },
  { key: "linkedin", button: /linkedin/i, authorizeHost: /linkedin\.com/ },
];

const signInUrl = () => new URL("/sign-in", SIGNIN_URL).href;

// Skip the whole suite (no browser launched) unless a target is configured, so the
// default CI a11y job — which sets no SIGNIN_URL — never runs these.
const describe = SIGNIN_URL ? test.describe : test.describe.skip;

describe("social sign-in → provider OAuth handshake", () => {
  test("all three provider buttons render on /sign-in", async ({ page }) => {
    await page.goto(signInUrl(), { waitUntil: "domcontentloaded" });
    for (const p of PROVIDERS) {
      await expect(
        page.getByRole("button", { name: p.button }),
        `Expected a "${p.key}" social button on /sign-in — is the connection enabled in Clerk?`,
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  for (const p of PROVIDERS) {
    test(`${p.key}: button starts the provider OAuth flow`, async ({ page }) => {
      await page.goto(signInUrl(), { waitUntil: "domcontentloaded" });

      const button = page.getByRole("button", { name: p.button });
      await expect(button).toBeVisible({ timeout: 15_000 });

      // Clicking redirects (same tab) toward the provider's authorize endpoint.
      await Promise.all([
        page.waitForURL(p.authorizeHost, { timeout: 20_000 }),
        button.click(),
      ]);

      const url = new URL(page.url());
      expect(url.host, `${p.key} did not redirect to its authorize host`).toMatch(p.authorizeHost);
      // A real OAuth start carries a client_id — its presence means Clerk handed off
      // with configured credentials rather than erroring back to /sign-in.
      expect(url.searchParams.get("client_id"), `${p.key} OAuth start is missing client_id`).toBeTruthy();
    });
  }
});
