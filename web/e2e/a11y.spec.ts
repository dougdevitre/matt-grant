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
  "/join",
  "/donate",
  "/data-policy",
  "/transparency",
  "/public-trust",
  "/terms",
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
  "/dashboard/playbook",
  "/dashboard/scorecard",
  "/dashboard/leaderboard",
  "/dashboard/coverage",
  "/dashboard/team",
  "/dashboard/targets",
  "/dashboard/plan",
  // Form/composer-heavy surfaces added after the initial pass — these are exactly
  // where a11y regressions hide (labels, contrast on custom controls), so keep
  // them in the gate.
  "/dashboard/sms",
  "/dashboard/social",
  "/dashboard/messages",
  "/dashboard/assets",
  "/dashboard/setup",
  "/dashboard/extension",
  "/dashboard/studio",
  "/dashboard/peace-room",
  "/dashboard/map",
  "/dashboard/events",
  "/dashboard/photos",
  // Account-gated /join detail forms (radio/checkbox groups + fieldsets). Reachable
  // only when the local server runs in open-demo mode, like the dashboard routes.
  "/join/volunteer",
  "/join/captain",
  // Supporter hub — carries the personalized summary + checklist; open-demo only.
  "/community",
];

const ROUTES = process.env.A11Y_BASE_URL ? PUBLIC_ROUTES : [...PUBLIC_ROUTES, ...DASHBOARD_ROUTES];

for (const path of ROUTES) {
  test(`a11y: ${path}`, async ({ page }) => {
    // Sample colors at REST, never mid-transition. Verified failure mode: the map
    // mode-switch buttons flip disabled (text-line, axe-exempt via the disabled
    // attribute) → enabled (text-slate, passes AA) when the scored feed loads;
    // when that flip lands during axe's analysis, `transition-colors` makes the
    // enabled markup still COMPUTE the old text-line color (#E4E2DA on white =
    // 1.29:1) — a "serious" violation on markup that passes at rest. globals.css
    // collapses all transitions under prefers-reduced-motion, so emulating it
    // makes state flips atomic (and exercises the app's reduced-motion path).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const report = blocking.map((v) => `  • ${v.id} (${v.nodes.length} node(s)) — ${v.help}`).join("\n");
    expect(blocking, `serious/critical a11y violations on ${path}:\n${report}`).toEqual([]);
  });
}
