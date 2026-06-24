import { NextResponse } from "next/server";

// Shared response envelope for the write/cron routes (research ingest + the drains).
// These responses feed the EventBridge scheduler and logs, not a UI, so one
// consistent { ok, … } shape keeps monitoring and grep simple.

/** 401 — missing/invalid CRON_SECRET bearer. */
export function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

/** 200 — ran but did nothing useful (a dependency isn't configured). */
export function skipped(reason: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, skipped: reason, ...extra });
}

/** 200 — success, with any job-specific fields. */
export function jobOk(extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...extra });
}

/** Failure — a clean status the scheduler can retry, with the cause in the logs. */
export function jobFailed(error: string, status = 502) {
  return NextResponse.json({ ok: false, error }, { status });
}
