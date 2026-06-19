import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Public pages must stay accessible (WCAG 2.0/2.1 A & AA) — this is the automated
// half of the compliance work (docs/compliance-audit.md). We fail only on
// serious/critical impacts so the gate stays actionable; moderate/minor are
// surfaced in the report but don't block. Staff dashboard pages are auth-gated
// and out of scope here.
const ROUTES = [
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
