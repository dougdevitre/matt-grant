import crypto from "node:crypto";

// Timing-safe comparison of a provided secret against the configured one. Used by
// inbound webhooks that accept a shared secret via either an Authorization header
// or a URL query param (different providers support different mechanisms). Pure +
// node-only so it's unit-testable without a request.
export function secretMatches(provided: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
