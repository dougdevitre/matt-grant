import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ISSUE_VANITY } from "./pillar-routing";
import { issueSlugs } from "./issues";

// Drift guard: the vanity-redirect table in the ops doc is the one place a code
// constant (ISSUE_VANITY) is duplicated in prose. If someone edits the map without
// the doc (or vice-versa), the redirect a constituent hits won't match what's
// documented for DNS/QA. This test parses the table and fails the PR on any drift.
// (Resource-pillar subdomains aren't asserted here: the docs cover them with a
// wildcard *.mattgrantforcongress.org rather than enumerating each, so there's
// nothing to drift — sitemap.ts already derives them from the catalog directly.)
describe("vanity subdomain docs ↔ ISSUE_VANITY", () => {
  const doc = readFileSync(path.join(process.cwd(), "docs", "pillar-subdomains.md"), "utf8");

  // Rows look like:  | `courts.mattgrantforcongress.org` | `/issues/family-courts` |
  const rowRe = /\|\s*`?([a-z]+)\.mattgrantforcongress\.org`?\s*\|\s*`?\/issues\/([a-z-]+)`?\s*\|/g;
  const documented: Record<string, string> = {};
  for (const m of doc.matchAll(rowRe)) documented[m[1]] = m[2];

  it("documents exactly the vanity labels defined in code", () => {
    expect(Object.keys(documented).sort()).toEqual(Object.keys(ISSUE_VANITY).sort());
  });

  it("maps each documented label to the same canonical issue slug as the code", () => {
    expect(documented).toEqual(ISSUE_VANITY);
  });

  it("only documents real issue slugs", () => {
    for (const slug of Object.values(documented)) expect(issueSlugs).toContain(slug);
  });
});
