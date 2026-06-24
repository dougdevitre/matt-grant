import { describe, it, expect } from "vitest";
import { pillarRewritePath, issueVanityRedirect, ISSUE_VANITY } from "./pillar-routing";
import { pillarForHost, pillarSlugs } from "./pillars";
import { issueSlugs } from "./issues";

describe("pillarRewritePath", () => {
  it("rewrites a pillar subdomain root to the pillar hub", () => {
    expect(pillarRewritePath("education.mattgrantforcongress.org", "/")).toBe("/pillars/education");
  });

  it("preserves the path under the pillar route", () => {
    expect(pillarRewritePath("education.mattgrantforcongress.org", "/iep-guide")).toBe("/pillars/education/iep-guide");
  });

  it("is case-insensitive on the host label", () => {
    expect(pillarRewritePath("Justice.MattGrantForCongress.org", "/x")).toBe("/pillars/justice/x");
  });

  it("passes the apex and www through unchanged", () => {
    expect(pillarRewritePath("mattgrantforcongress.org", "/about")).toBeNull();
    expect(pillarRewritePath("www.mattgrantforcongress.org", "/about")).toBeNull();
  });

  it("passes localhost and unknown labels through", () => {
    expect(pillarRewritePath("localhost", "/")).toBeNull();
    expect(pillarRewritePath("dashboard.mattgrantforcongress.org", "/")).toBeNull();
  });

  it("never hijacks API calls or already-rewritten paths", () => {
    expect(pillarRewritePath("education.mattgrantforcongress.org", "/api/x")).toBeNull();
    expect(pillarRewritePath("education.mattgrantforcongress.org", "/pillars/education")).toBeNull();
  });

  it("ignores a port on the host", () => {
    expect(pillarForHost("education.localhost:3000")?.slug).toBe("education");
  });
});

describe("issueVanityRedirect", () => {
  it("redirects each vanity label to its canonical issue page", () => {
    expect(issueVanityRedirect("courts.mattgrantforcongress.org")).toBe("https://mattgrantforcongress.org/issues/family-courts");
    expect(issueVanityRedirect("limits.mattgrantforcongress.org")).toBe("https://mattgrantforcongress.org/issues/term-limits");
    expect(issueVanityRedirect("lean.mattgrantforcongress.org")).toBe("https://mattgrantforcongress.org/issues/smaller-government");
    expect(issueVanityRedirect("taxes.mattgrantforcongress.org")).toBe("https://mattgrantforcongress.org/issues/lower-taxes");
  });

  it("is case-insensitive and ignores a port", () => {
    expect(issueVanityRedirect("TAXES.localhost:3000")).toBe("https://mattgrantforcongress.org/issues/lower-taxes");
  });

  it("returns null for the apex, a resource pillar, or an unknown label", () => {
    expect(issueVanityRedirect("mattgrantforcongress.org")).toBeNull();
    expect(issueVanityRedirect("justice.mattgrantforcongress.org")).toBeNull(); // stays the legal-aid hub
    expect(issueVanityRedirect("nope.mattgrantforcongress.org")).toBeNull();
  });

  it("maps only to real issue slugs and never collides with a resource pillar label", () => {
    for (const [label, slug] of Object.entries(ISSUE_VANITY)) {
      expect(issueSlugs).toContain(slug);
      expect(pillarSlugs).not.toContain(label);
    }
  });
});
