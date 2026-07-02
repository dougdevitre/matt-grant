import { NextResponse } from "next/server";
import { checkCap } from "@/lib/auth";
import type { Capability } from "@/lib/rbac";
import { ok, fail, type Provenance } from "@/lib/data/resource";
import { preflight, withCors } from "@/lib/http/cors";

// Factory for a read-only extension endpoint (mirrors lib/data/geo.ts's geoRoute).
// It bundles the three things every /api/ext/* route needs so no route hand-rolls
// them and they can't drift apart:
//   1. CORS for the allowlisted extension origin (OPTIONS preflight + response headers)
//   2. authorization via the SAME Clerk capability gate the dashboard uses (checkCap)
//   3. the app's standard Resource<T> envelope, so extension reads look like every
//      other data source in the app.
//
// The extension authenticates exactly like the web app: Clerk's clerkMiddleware
// accepts the session token from the `Authorization: Bearer` header (once
// CLERK_AUTHORIZED_PARTIES trusts the extension), so checkCap() resolves the same
// publicMetadata.role → can(capability) verdict with no second auth path.
export function extRoute<T>(opts: {
  capability: Capability;
  /** Human label for the Resource provenance, e.g. "campaign overview". */
  source: string;
  /** Loads the payload. Throw to yield a 502 fail envelope. */
  load: (req: Request) => Promise<T>;
}): {
  GET: (req: Request) => Promise<Response>;
  OPTIONS: (req: Request) => Response;
} {
  const meta = (): Provenance => ({ source: opts.source, kind: "api", live: true });

  async function GET(req: Request): Promise<Response> {
    const { allowed } = await checkCap(opts.capability);
    // Even the 403/502 carry CORS headers, or the extension's fetch can't read the
    // status to react to it.
    if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta()), { status: 403 }), req);
    try {
      const data = await opts.load(req);
      return withCors(NextResponse.json(ok(data, meta())), req);
    } catch {
      return withCors(NextResponse.json(fail("source unavailable", meta()), { status: 502 }), req);
    }
  }

  function OPTIONS(req: Request): Response {
    return preflight(req);
  }

  return { GET, OPTIONS };
}
