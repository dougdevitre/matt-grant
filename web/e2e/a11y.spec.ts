import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Pages must stay accessible (WCAG 2.0/2.1 A & AA) — the automated half of the
// compliance work (docs/compliance-audit.md). We fail only on serious/critical
// impacts so the gate stays actionable; moderate/minor are surfaced in the report
// but don't block.
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/issues",
  "/act",
  "/vote",
  "/media",
  "/press",
  "/contact",
  "/donate",
  "/data-policy",
  "/transparency",
  "/public-trust",
];

// Staff dashboard pages. Only scannable when the local server boots in open-demo
// mode (playwright.config sets ALLOW_OPEN_DASHBOARD + Clerk off); a deployed URL
// keeps them gated, so skip them there.
const DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/research",
  "/dashboard/donors",
  "/dashboard/finance",
  "/dashboard/compliance",
  "/dashboard/emails",
  "/dashboard/subscribers",
  "/dashboard/tasks",
  "/dashboard/volunteers",
  "/dashboard/team",
  "/dashboard/targets",
  "/dashboard/plan",
];

const ROUTES = process.env.A11Y_BASE_URL ? PUBLIC_ROUTES : [...PUBLIC_ROUTES, ...DASHBOARD_ROUTES];

for (const path of ROUTES) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const report = blocking.map((v) => `  • ${v.id} (${v.nodes.length} node(s)) — ${v.help}`).join("\n");
    expect(blocking, `serious/critical a11y violations on ${path}:\n${report}`).toEqual([]);
  });
}
