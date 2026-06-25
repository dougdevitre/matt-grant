import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { pillarOrVanityResponse } from "./pillar-middleware";

// Integration coverage for the one hardened path the pure-helper tests can't reach:
// the actual NextResponse the middleware emits per host. Clerk-free by construction
// (pillar-middleware.ts imports no Clerk), so this runs without auth env or mocks.
const req = (host: string, pathname = "/") =>
  new NextRequest(`https://${host}${pathname}`, { headers: { host } });

describe("pillarOrVanityResponse", () => {
  it("308-redirects a vanity issue subdomain to the canonical apex page", () => {
    const res = pillarOrVanityResponse(req("courts.mattgrantforcongress.org"));
    expect(res?.status).toBe(308);
    expect(res?.headers.get("location")).toBe("https://mattgrantforcongress.org/issues/family-courts");
  });

  it("drops the path/query on a vanity redirect (one canonical target)", () => {
    const res = pillarOrVanityResponse(req("taxes.mattgrantforcongress.org", "/deep/path?x=1"));
    expect(res?.status).toBe(308);
    expect(res?.headers.get("location")).toBe("https://mattgrantforcongress.org/issues/lower-taxes");
  });

  it("internally rewrites a pillar subdomain to its /pillars/<slug> route", () => {
    const res = pillarOrVanityResponse(req("education.mattgrantforcongress.org", "/iep-guide"));
    // A rewrite is a 200-class response carrying the internal target header — NOT a redirect.
    expect(res?.status).not.toBe(308);
    expect(res?.headers.get("x-middleware-rewrite")).toContain("/pillars/education/iep-guide");
  });

  it("rewrites a pillar root to the bare hub path", () => {
    const res = pillarOrVanityResponse(req("justice.mattgrantforcongress.org", "/"));
    expect(res?.headers.get("x-middleware-rewrite")).toMatch(/\/pillars\/justice$/);
  });

  it("passes the apex, www, localhost, and unknown subdomains through (null)", () => {
    expect(pillarOrVanityResponse(req("mattgrantforcongress.org"))).toBeNull();
    expect(pillarOrVanityResponse(req("www.mattgrantforcongress.org"))).toBeNull();
    expect(pillarOrVanityResponse(req("localhost"))).toBeNull();
    expect(pillarOrVanityResponse(req("dashboard.mattgrantforcongress.org"))).toBeNull();
  });

  it("never hijacks /api/* or already-rewritten /pillars/* on a pillar host", () => {
    expect(pillarOrVanityResponse(req("education.mattgrantforcongress.org", "/api/x"))).toBeNull();
    expect(pillarOrVanityResponse(req("education.mattgrantforcongress.org", "/pillars/education"))).toBeNull();
  });
});

describe("pillarOrVanityResponse unknown-subdomain logging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("warns once when an unrecognized apex subdomain falls through", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(pillarOrVanityResponse(req("nope.mattgrantforcongress.org"))).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("'nope'");
  });

  it("stays quiet for the apex, www, and known pillar/vanity hosts", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    pillarOrVanityResponse(req("mattgrantforcongress.org"));
    pillarOrVanityResponse(req("www.mattgrantforcongress.org"));
    pillarOrVanityResponse(req("education.mattgrantforcongress.org")); // rewritten, not fall-through
    pillarOrVanityResponse(req("courts.mattgrantforcongress.org")); // redirected
    expect(warn).not.toHaveBeenCalled();
  });
});
