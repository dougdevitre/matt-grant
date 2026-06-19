// Standard API response envelope — owned by Lane 1 (Foundation).
//
// Route handlers across the app currently return a mix of shapes: `{ error }`,
// `{ ok: false, error }`, plain text, and reflected upstream JSON. Standardize on
// these helpers so every JSON API speaks one language and never leaks raw error
// internals (String(err)) to clients.
//
// Usage:
//   import { apiOk, apiError, apiFail } from "@/lib/contracts/api";
//   return apiOk({ items });                         // 200 { items }
//   return apiError("Forbidden", 403);               // 403 { error: "Forbidden" }
//   try { ... } catch (err) { return apiFail(err, "Upstream failed", 502); }

import { NextResponse } from "next/server";

export type ApiErrorBody = { error: string };

/** Success envelope. Pass the data object; it is returned as-is with `init`. */
export function apiOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/** Error envelope with a client-safe message. Never put raw exceptions here. */
export function apiError(message: string, status = 500, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: message, ...(extra ?? {}) }, { status });
}

/**
 * Catch-handler helper: logs the real error server-side (with optional context)
 * and returns a generic client-safe message. Prevents the String(err) leak the
 * assessment flagged across several routes.
 */
export function apiFail(err: unknown, message = "Internal error", status = 500, context?: string): NextResponse {
  console.error(`[api]${context ? ` ${context}:` : ""}`, err);
  return apiError(message, status);
}

/** Standard 401/403 helpers so auth responses are identical everywhere. */
export const unauthorized = () => apiError("Unauthorized", 401);
export const forbidden = () => apiError("Forbidden", 403);
