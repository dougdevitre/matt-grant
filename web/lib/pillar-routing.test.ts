import { describe, it, expect } from "vitest";
import { pillarRewritePath } from "./pillar-routing";
import { pillarForHost } from "./pillars";

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
