import { NextResponse, type NextRequest } from "next/server";
import {
  pillarRewritePath,
  issueVanityRedirect,
  unknownPillarSubdomain,
  reservedSubdomainRewrite,
} from "./pillar-routing";

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

// Reserved subdomains (games.) are served by the same app: rewrite the host's label
// to its internal route prefix (e.g. /games). Internal rewrite — the address bar
// stays on the subdomain — exactly like the pillar rewrite. /api/* and already-
// prefixed paths pass through.
export function reservedRewrite(req: NextRequest): NextResponse | null {
  const target = reservedSubdomainRewrite(req.headers.get("host"), req.nextUrl.pathname);
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
  const routed = issueVanity(req) ?? reservedRewrite(req) ?? pillarRewrite(req);
  if (routed) return routed;
  // Nothing matched. If this was an unrecognized subdomain of the apex (wildcard DNS
  // routes every label here), warn so catalog/DNS drift or a typo is visible in logs.
  const unknown = unknownPillarSubdomain(req.headers.get("host"));
  if (unknown) {
    console.warn(`[pillar] unknown subdomain '${unknown}' — fell through to apex (catalog/DNS drift?)`);
  }
  return null;
}
