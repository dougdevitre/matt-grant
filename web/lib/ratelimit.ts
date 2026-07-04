import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";

// Fixed-window per-key rate limiter backed by DynamoDB so it works across the
// stateless SSR Lambda's instances (an in-memory counter would only bound one
// warm container). Each (key, window) is one atomic ADD; rows self-expire via the
// table's TTL attribute, so there is nothing to sweep.
//
// FAIL-OPEN by design: if the store is unavailable or unconfigured we ALLOW the
// request. Abuse protection must never become a self-inflicted outage that blocks
// legitimate donors/users when DynamoDB hiccups.

export type RateDecision = { allowed: boolean; count: number; limit: number; resetAt: number };

// Pure window math, extracted so the bucketing is unit-testable without DynamoDB.
// Returns the unix-seconds start of the fixed window containing nowMs.
export function windowStart(nowMs: number, windowSec: number): number {
  return Math.floor(nowMs / 1000 / windowSec) * windowSec;
}

// Client IP for rate-limiting. PREFER CloudFront's `cloudfront-viewer-address` —
// it is the address of the TCP peer CloudFront actually saw, stamped by the
// trusted edge and NOT forgeable by the client, so it is immune to the
// x-forwarded-for spoofing below and independent of how many proxy hops sit in
// front of the app. On this Amplify deployment the SSR request traverses two
// chained CloudFront distributions, so the app-visible x-forwarded-for is
// `<client>, <inner-CloudFront>` — its rightmost entry is a shared CloudFront IP,
// not the client (verified live 2026-07-04), which is exactly why hop-counting
// XFF is the fallback, not the primary source. Format is "<ip>:<port>" (the ip
// may itself contain colons for IPv6), so strip the trailing :port.
//
// FALLBACK (local dev / non-CloudFront proxies): x-forwarded-for is built
// left-to-right (client, proxy1, proxy2, …) and the LEFTMOST entries are
// attacker-supplied — trusted proxies only APPEND. Keying on the leftmost value
// would let an anonymous caller rotate a fake IP per request and defeat every
// limit, so we count RATELIMIT_TRUSTED_PROXY_HOPS from the RIGHT (default 1).
export function clientIp(req: Request): string {
  const cfViewer = req.headers.get("cloudfront-viewer-address");
  if (cfViewer) {
    const idx = cfViewer.lastIndexOf(":");
    const ip = (idx > 0 ? cfViewer.slice(0, idx) : cfViewer).replace(/^\[|\]$/g, "");
    if (ip) return ip;
  }
  const parts = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const hops = Math.max(1, Number(process.env.RATELIMIT_TRUSTED_PROXY_HOPS) || 1);
  const client = parts[parts.length - hops] ?? parts[0];
  return client || req.headers.get("x-real-ip") || "unknown";
}

export async function rateLimit(
  key: string,
  opts: { limit: number; windowSec: number },
  nowMs: number = Date.now(),
): Promise<RateDecision> {
  const { limit, windowSec } = opts;
  const start = windowStart(nowMs, windowSec);
  const resetAt = start + windowSec;
  if (!dbConfigured) return { allowed: true, count: 0, limit, resetAt };

  try {
    const out = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.rateLimit, SK: `${key}#${start}` },
        // Atomic increment; keep the row alive one extra window past reset so a
        // late read in the same window still sees the count, then TTL reaps it.
        UpdateExpression: "ADD #c :one SET #ttl = :ttl",
        ExpressionAttributeNames: { "#c": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: { ":one": 1, ":ttl": resetAt + windowSec },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    const count = Number(out.Attributes?.count ?? 1);
    return { allowed: count <= limit, count, limit, resetAt };
  } catch {
    return { allowed: true, count: 0, limit, resetAt }; // fail-open
  }
}
