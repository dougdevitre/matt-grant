import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Interaction tests for the primary nav — the surfaces unit tests can't cover:
// the desktop dropdown hover behavior, the mobile drawer's focus/escape, the
// phase-aware CTA, and a11y of the OPEN menu (axe in a11y.spec only sees it closed).

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

test.describe("desktop dropdown", () => {
  test.use({ viewport: DESKTOP });

  // Regression: the panel sits 18px below the trigger; before the hover bridge,
  // moving the cursor onto an item crossed dead space, closed the menu, and the
  // click never landed. This must keep passing.
  test("submenu items are clickable across the gap", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Get Involved" }).hover();
    // Scope to the header — the footer also lists every nav link.
    const item = page.locator("header").getByRole("link", { name: "Take Action" });
    await expect(item).toBeVisible();
    await item.click();
    await expect(page).toHaveURL(/\/act$/);
  });

  test("opens and roves with the keyboard", async ({ page, browserName }) => {
    // WebKit AND Firefox handle programmatic focus on links differently from their
    // default tab model, which makes `toBeFocused()` after an ArrowDown rove flaky on
    // both engines (intermittent "inactive"). The roving logic is verified on Chromium.
    test.skip(browserName !== "chromium", "non-Chromium link-focus model is flaky for roving focus");
    await page.goto("/");
    await page.getByRole("button", { name: "Get Involved" }).focus();
    await page.keyboard.press("ArrowDown");
    // ArrowDown lands on the first item in the Get Involved dropdown — "Join the Movement".
    await expect(page.locator("header").getByRole("link", { name: "Join the Movement" })).toBeFocused();
  });
});

test.describe("mobile drawer", () => {
  test.use({ viewport: PHONE });

  test("traps focus while open and closes on Escape", async ({ page, browserName }) => {
    // WebKit's default tab order (like Safari without Full Keyboard Access)
    // excludes links/buttons, so Tab can't be driven through the drawer there.
    // The trap logic is engine-independent; verified on Chromium.
    test.skip(browserName === "webkit", "Safari default tab order excludes links");
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle menu" }).click();
    const drawer = page.locator("#mobile-drawer");
    await expect(drawer).toBeVisible();

    // Tab well past the number of items; focus must never leave the drawer
    // (without the trap it would reach the page/footer/action-bar behind it).
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("hides the Ask Matt FAB while open", async ({ page }) => {
    await page.goto("/");
    const fab = page.getByRole("button", { name: /Ask Matt/ });
    await expect(fab).toBeVisible();
    await page.getByRole("button", { name: "Toggle menu" }).click();
    await expect(page.locator("#mobile-drawer")).toBeVisible();
    await expect(fab).toBeHidden();
  });

  test("opens with the current section pre-expanded", async ({ page }) => {
    await page.goto("/issues"); // /issues lives under the "About" group
    await page.getByRole("button", { name: "Toggle menu" }).click();
    await expect(page.locator("#mobile-drawer").getByRole("link", { name: "Issues" })).toBeVisible();
  });

  test("open drawer has no serious/critical a11y violations", async ({ page }) => {
    // Scan with motion reduced so axe sees the settled panel, not a frame
    // mid-fade (where it would briefly read as translucent over the hero).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle menu" }).click();
    await expect(page.locator("#mobile-drawer")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include("#mobile-drawer")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const report = blocking.map((v) => `  • ${v.id} — ${v.help}`).join("\n");
    expect(blocking, `serious/critical a11y in open drawer:\n${report}`).toEqual([]);
  });
});

test.describe("phase-aware CTA (GOTV)", () => {
  // Pin the clock inside the final-stretch window so the menu renders its GOTV
  // state — the behavior that otherwise only goes live ~2 weeks before Aug 4.
  test("swaps the primary CTA to turnout and emphasizes Vote", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-07-25T12:00:00-05:00"));

    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Plan your vote" })).toBeVisible();
    // Donate stays as a secondary ask in the header during GOTV.
    await expect(header.getByRole("link", { name: "Donate", exact: true })).toBeVisible();

    // On mobile, the bottom action bar should emphasize Vote (brick) in GOTV.
    await page.setViewportSize(PHONE);
    await page.goto("/");
    const voteAction = page.locator('nav[aria-label="Quick actions"]').getByRole("link", { name: "Vote" });
    await expect(voteAction).toHaveClass(/text-brick/);
  });
});
