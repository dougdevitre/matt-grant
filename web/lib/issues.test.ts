import { describe, it, expect } from "vitest";
import { ISSUES } from "@/lib/issues";
import { safeHref } from "@/lib/strategy/engine";

// Safeguard gate for the curated per-issue checklists: every issue must carry a
// real checklist, every item must be faithful (non-empty, no leftover template
// tokens, a known tag), and every link must survive safeHref unchanged — i.e. be
// on the internal/campaign allowlist. An unsafe or off-platform link fails CI.

const ALLOWED_TAGS = new Set(["Learn", "Attend", "Ask", "Share", "Vote", "Act", "Write", "Watchdog"]);

describe("issue checklists", () => {
  it("every issue has a non-empty checklist", () => {
    for (const issue of ISSUES) {
      expect(issue.checklist, `${issue.slug} is missing a checklist`).toBeTruthy();
      expect(issue.checklist!.length, `${issue.slug} checklist is empty`).toBeGreaterThan(0);
    }
  });

  it("items have real, faithful text with no leftover {placeholder} tokens", () => {
    for (const issue of ISSUES) {
      for (const item of issue.checklist ?? []) {
        expect(item.text.trim().length, `${issue.slug}: empty checklist text`).toBeGreaterThan(0);
        expect(item.text, `${issue.slug}: unresolved token in "${item.text}"`).not.toMatch(/\{[a-z]+\}/i);
      }
    }
  });

  it("every tag is from the allowed civic-action set", () => {
    for (const issue of ISSUES) {
      for (const item of issue.checklist ?? []) {
        expect(ALLOWED_TAGS.has(item.tag), `${issue.slug}: unexpected tag "${item.tag}"`).toBe(true);
      }
    }
  });

  it("every link is on the safeHref allowlist (internal/campaign only)", () => {
    for (const issue of ISSUES) {
      for (const item of issue.checklist ?? []) {
        if (item.href === undefined) continue;
        // safeHref returns the href unchanged when allowed, undefined when not.
        expect(safeHref(item.href), `${issue.slug}: unsafe link "${item.href}"`).toBe(item.href);
      }
    }
  });
});
