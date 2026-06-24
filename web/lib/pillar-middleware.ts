import { NextResponse, type NextRequest } from "next/server";
import { pillarRewritePath, issueVanityRedirect } from "./pillar-routing";

// The host-based routing pre-check shared by both branches of middleware.ts
// (Clerk-enabled and the fail-closed fallback). Kept in its own module — free of
// any Clerk import — so it is unit-testable with plain NextRequest objects, and so
// the two middleware branches can't drift in how they handle pillar/vanity hosts.

// Vanity issue subdomains (courts./limits./lean./taxes.) 308-redirect to the
// canonical /issues/<slug> page on the apex. Returns null for every other host.
export function issueVanity(req: NextRequest): NextResponse | null {
  const target = issueVanityRedirect(req.headers.get("host"));
  return target ? NextResponse.redirect(target, 308) : null;
}

// Pillar subdomains (e.g. education.mattgrantforcongress.org) are served by the
// same app: rewrite the host's leftmost label to the /pillars/<slug> route group,
// which lives under (site) and therefore inherits the shared header/footer/AskMatt.
// Internal rewrite (the address bar stays on the subdomain), not a redirect. Apex,
// www, localhost, /api/*, and already-rewritten /pillars/* pass through untouched.
export function pillarRewrite(req: NextRequest): NextResponse | null {
  const target = pillarRewritePath(req.headers.get("host"), req.nextUrl.pathname);
  if (!target) return null;
  const url = req.nextUrl.clone();
  url.pathname = target;
  return NextResponse.rewrite(url);
}

// Combined pre-check: vanity redirect first (it short-circuits before the rewrite —
// the labels never overlap, but redirect-before-rewrite keeps the intent obvious),
// then the pillar rewrite. Returns the response to send immediately, or null to let
// the rest of the middleware (auth gating) run.
export function pillarOrVanityResponse(req: NextRequest): NextResponse | null {
  return issueVanity(req) ?? pillarRewrite(req);
}
