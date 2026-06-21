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

// Client IP from the proxy chain. Amplify/CloudFront set x-forwarded-for; we take
// the first hop (the original client). Falls back to a constant so a missing
// header buckets together rather than throwing.
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
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
