import crypto from "node:crypto";
import { getSecret } from "@/lib/ssm";

// Single source of truth for authenticating the EventBridge-driven cron routes
// (/api/cron/social-drain, /api/cron/email-drain). The scheduler injects a static
// `Authorization: Bearer <CRON_SECRET>` header via its EventBridge Connection, so
// the gate is a timing-safe compare against that secret. Fail-closed: no secret
// configured → unauthorized. (Per-request signing/replay nonces aren't possible —
// the scheduler can only send a fixed header.)

/** True iff the request carries the correct CRON_SECRET bearer (timing-safe). */
export async function cronAuthorized(req: Request): Promise<boolean> {
  const secret = await getSecret("CRON_SECRET");
  if (!secret) return false; // fail closed when unconfigured
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  // Length check first: timingSafeEqual throws on unequal lengths.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
