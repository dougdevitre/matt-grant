import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Regression guard: EVERY API route under app/api/** must enforce access with a
// real authorization primitive — a capability check (checkCap/requireCap/can),
// a staff check (isStaff/requireStaff), or the cron bearer (cronAuthorized) —
// UNLESS it is an intentionally public endpoint or a signature/secret-verified
// webhook (both allowlisted below with a reason).
//
// Why not accept a bare `staffGate()`? Because `gate.ok` is true for any signed-in
// user, including the public `supporter` tier — gating on `.ok` alone is exactly
// the bug this suite was added to close (assets/* + research/member/*). A route
// must resolve a capability/staff verdict, not just "is someone signed in".
//
// Hermetic: reads the source tree only. If a new route is legitimately public or
// webhook-verified, add it to ALLOW with a reason rather than weakening the check.

const API = join(__dirname); // app/api

// Real authorization primitives (NOT bare staffGate().ok).
const AUTH = /checkCap\s*\(|requireCap\s*\(|requireStaff\s*\(|isStaff\s*\(|\bcan\s*\(|cronAuthorized\s*\(/;

// Intentionally public endpoints (rate-limited public reads/writes, public
// generators, or public geo/ICS) and signature/secret-verified webhooks. Each is
// exempt from the capability requirement by design — documented here.
const ALLOW = new Set<string>([
  // Public content / generators
  "app/api/graphics/route.tsx",
  "app/api/press/topics/route.ts",
  "app/api/issues/local-response/route.ts",
  "app/api/issues/local-snapshot/route.ts",
  "app/api/unsubscribe/route.ts",
  // Public calendar feeds
  "app/api/events/calendar.ics/route.ts",
  "app/api/events/[id]/calendar.ics/route.ts",
  // Public games
  "app/api/games/flags/route.ts",
  "app/api/games/lead/route.ts",
  "app/api/games/leaderboard/route.ts",
  "app/api/games/score/route.ts",
  // Public geo (the map explorer; geo/events IS capability-gated and excluded here)
  "app/api/geo/extra-counties/route.ts",
  "app/api/geo/jefferson/route.ts",
  "app/api/geo/pois/route.ts",
  "app/api/geo/precincts/route.ts",
  // Public print studio (Walgreens ordering)
  "app/api/print/coupon/route.ts",
  "app/api/print/order/route.ts",
  "app/api/print/products/route.ts",
  "app/api/print/status/route.ts",
  "app/api/print/stores/route.ts",
  // Public research reads / AI (the *member* store routes ARE gated and excluded here)
  "app/api/research/alignment/route.ts",
  "app/api/research/census/route.ts",
  "app/api/research/child-act/route.ts",
  "app/api/research/contrast-card/route.tsx",
  "app/api/research/graphic/route.tsx",
  "app/api/research/health/route.ts",
  "app/api/research/script/route.ts",
  "app/api/research/timeline/route.ts",
  // Webhooks — verified by provider signature / shared secret, not a Clerk session
  "app/api/webhooks/clerk/route.ts",
  "app/api/webhooks/inbound-email/route.ts",
  "app/api/webhooks/ses/route.ts",
  "app/api/webhooks/twilio/route.ts",
  "app/api/webhooks/winred/route.ts",
]);

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...routeFiles(p));
    else if (e.name === "route.ts" || e.name === "route.tsx") out.push(p);
  }
  return out;
}

describe("api route auth coverage", () => {
  const files = routeFiles(API);

  it("finds the api routes", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("every non-public, non-webhook route enforces a capability/staff/cron check", () => {
    const ungated: string[] = [];
    for (const f of files) {
      const rel = f.slice(f.indexOf("app/api/"));
      if (ALLOW.has(rel)) continue;
      if (!AUTH.test(readFileSync(f, "utf8"))) ungated.push(rel);
    }
    expect(
      ungated,
      `ungated api routes (add a real gate, or allowlist with a reason):\n${ungated.join("\n")}`,
    ).toEqual([]);
  });

  it("allowlisted paths all still exist (no stale entries)", () => {
    const present = new Set(files.map((f) => f.slice(f.indexOf("app/api/"))));
    const stale = [...ALLOW].filter((p) => !present.has(p));
    expect(stale, `stale ALLOW entries:\n${stale.join("\n")}`).toEqual([]);
  });
});
