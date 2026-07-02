import { NextResponse } from "next/server";
import { z } from "zod";
import { withCors, preflight } from "@/lib/http/cors";
import { checkCap } from "@/lib/auth";
import { setSubmissionStatus, updateSubmissionText, deleteSubmission } from "@/lib/issue-board/airtable";
import { recordExtAction } from "@/lib/audit";
import { ok, fail, type Provenance } from "@/lib/data/resource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const meta: Provenance = { source: "issue submission", kind: "api", live: true };

export function OPTIONS(req: Request): Response {
  return preflight(req);
}

// The lib functions self-gate on the Airtable "Front-End Access" control table and
// throw when a toggle is off — surface that as 403, not 502.
function libDenied(err: unknown): boolean {
  return err instanceof Error && /disabled in Front-End Access/i.test(err.message);
}

// PATCH — a moderation decision (status) OR a text edit (topic/details). Status
// takes precedence when both are sent. moderateIssues (Clerk) + the Airtable
// dashboard-update gate inside the lib.
const PatchSchema = z
  .object({
    status: z.enum(["Approved", "Rejected", "Pending"]).optional(),
    topic: z.string().trim().min(1).max(300).optional(),
    details: z.string().trim().max(5000).optional(),
  })
  .refine((o) => o.status !== undefined || o.topic !== undefined || o.details !== undefined, {
    message: "Provide status, topic, or details.",
  });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { allowed, gate } = await checkCap("moderateIssues");
  if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  const { id } = await params;
  if (!id) return withCors(NextResponse.json(fail("missing id", meta), { status: 400 }), req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return withCors(NextResponse.json(fail("invalid update", meta), { status: 400 }), req);
  try {
    let action: string;
    if (parsed.data.status !== undefined) {
      await setSubmissionStatus(id, parsed.data.status);
      action = "issue.status";
    } else {
      await updateSubmissionText(id, { topic: parsed.data.topic, details: parsed.data.details });
      action = "issue.text";
    }
    await recordExtAction({ at: new Date().toISOString(), actor: gate.email ?? "unknown", action, target: id });
    return withCors(NextResponse.json(ok({ id }, meta)), req);
  } catch (err) {
    if (libDenied(err)) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
    return withCors(NextResponse.json(fail("could not update submission", meta), { status: 502 }), req);
  }
}

// DELETE — remove a spam submission. moderateIssues + the Airtable delete gate.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { allowed, gate } = await checkCap("moderateIssues");
  if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  const { id } = await params;
  if (!id) return withCors(NextResponse.json(fail("missing id", meta), { status: 400 }), req);
  try {
    await deleteSubmission(id);
    await recordExtAction({ at: new Date().toISOString(), actor: gate.email ?? "unknown", action: "issue.delete", target: id });
    return withCors(NextResponse.json(ok({ id, deleted: true }, meta)), req);
  } catch (err) {
    if (libDenied(err)) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
    return withCors(NextResponse.json(fail("could not delete submission", meta), { status: 502 }), req);
  }
}
