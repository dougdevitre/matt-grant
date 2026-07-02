import { NextResponse } from "next/server";

// CORS for the extension API surface (app/api/ext/*). This is the ONE place the
// app opens cross-origin access, so it stays small and auditable. The rest of the
// app is same-origin only (no CORS anywhere else, by design).
//
// EXTENSION_ORIGIN is a comma-separated allowlist of exact origins permitted to
// call /api/ext/*, e.g. "chrome-extension://abcdef…". Empty = no cross-origin
// access at all (fail-closed: the browser blocks the extension from reading the
// response). Pair this with Clerk's CLERK_AUTHORIZED_PARTIES (see middleware.ts)
// so a token minted for the extension is actually trusted.

function allowedOrigins(): string[] {
  return (process.env.EXTENSION_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when `origin` is on the EXTENSION_ORIGIN allowlist. */
export function isAllowedOrigin(origin: string | null): origin is string {
  return !!origin && allowedOrigins().includes(origin);
}

const ALLOW_METHODS = "GET, POST, PATCH, OPTIONS";
const ALLOW_HEADERS = "Authorization, Content-Type";
const MAX_AGE = "600"; // cache the preflight for 10 min

// Headers for a request's Origin. An unknown/absent origin gets ONLY `Vary: Origin`
// (no Access-Control-Allow-Origin), so the browser blocks the cross-origin read —
// same-origin app calls are unaffected. `Vary: Origin` keeps a CDN/browser cache
// from serving one origin's ACAO to another.
export function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { Vary: "Origin" };
  if (isAllowedOrigin(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Credentials"] = "true";
    h["Access-Control-Allow-Methods"] = ALLOW_METHODS;
    h["Access-Control-Allow-Headers"] = ALLOW_HEADERS;
    h["Access-Control-Max-Age"] = MAX_AGE;
  }
  return h;
}

/** Preflight responder: 204 carrying the CORS headers for this request's Origin. */
export function preflight(req: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/** Copy the CORS headers for this request's Origin onto an existing response. */
export function withCors(res: NextResponse, req: Request): NextResponse {
  for (const [k, v] of Object.entries(corsHeaders(req.headers.get("origin")))) res.headers.set(k, v);
  return res;
}
