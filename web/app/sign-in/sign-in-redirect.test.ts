import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression guard for the sign-in → dashboard contract. Clerk renders the social
// buttons (Google / Facebook / LinkedIn); what THIS repo controls is where a
// completed sign-in lands: both the <SignIn/> and <SignUp/> pages must hand off to
// /go (the role router in app/go, which sends staff to /dashboard). If someone drops
// or changes fallbackRedirectUrl, users get stranded on Clerk's default landing
// instead of the dashboard — this catches that at the source level (hermetic; no
// Clerk keys or DOM needed, matching the app/dashboard/auth-coverage.test.ts style).

const cases = [
  { name: "sign-in", file: join(__dirname, "[[...sign-in]]", "page.tsx"), component: "SignIn" },
  { name: "sign-up", file: join(__dirname, "..", "sign-up", "[[...sign-up]]", "page.tsx"), component: "SignUp" },
];

describe("auth pages redirect to /go after success", () => {
  for (const c of cases) {
    it(`${c.name} renders <${c.component} fallbackRedirectUrl="/go" />`, () => {
      const src = readFileSync(c.file, "utf8");
      // The Clerk component is rendered with the /go handoff.
      expect(src).toMatch(new RegExp(`<${c.component}\\b`));
      expect(src).toMatch(/fallbackRedirectUrl="\/go"/);
    });
  }
});
