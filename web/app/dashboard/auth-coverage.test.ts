import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Regression guard: EVERY dashboard page must enforce a capability at the page level — via
// requireCap() (preferred) or the staffGate()+can()+redirect pattern — not lean on the layout's
// staff-or-not check + the sidebar hiding a link. The sidebar is UX, never security: a direct URL
// must still be gated. (Closed a sweep of 9 ungated pages; this keeps them closed.)
//
// Hermetic: just reads the source tree. If a new page legitimately needs no per-cap gate, add it
// to ALLOW with a reason rather than weakening the check.

const DASH = join(__dirname); // app/dashboard

// Pages intentionally exempt from a per-capability gate (none today). Document the reason here.
const ALLOW = new Set<string>([]);

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...pageFiles(p));
    else if (e.name === "page.tsx") out.push(p);
  }
  return out;
}

describe("dashboard page auth coverage", () => {
  const files = pageFiles(DASH);

  it("finds the dashboard pages", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("every page enforces a capability (requireCap or staffGate+can)", () => {
    const ungated: string[] = [];
    for (const f of files) {
      const rel = f.slice(f.indexOf("app/dashboard/"));
      if (ALLOW.has(rel)) continue;
      const src = readFileSync(f, "utf8");
      // A page is gated by requireCap(), OR by staffGate()+can() *plus an actual
      // control-flow bailout* (redirect/notFound/requireStaff). Requiring the bailout
      // is the point: staffGate()+can() alone can be present purely for display flags
      // (donor badges, admin nudges) while the page still renders for everyone — the
      // exact hole that leaked the volunteer roster. Imports aren't a gate; a branch is.
      const bailout = /\bredirect\s*\(/.test(src) || /\bnotFound\s*\(/.test(src) || /\brequireStaff\s*\(/.test(src);
      const gated = /requireCap\s*\(/.test(src) || (/staffGate\s*\(/.test(src) && /\bcan\s*\(/.test(src) && bailout);
      if (!gated) ungated.push(rel);
    }
    expect(ungated, `ungated dashboard pages:\n${ungated.join("\n")}`).toEqual([]);
  });
});
