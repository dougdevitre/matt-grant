import { NextResponse } from "next/server";
import { z } from "zod";
import { withCors, preflight } from "@/lib/http/cors";
import { checkCap } from "@/lib/auth";
import { updateEvent } from "@/lib/events";
import { recordExtAction } from "@/lib/audit";
import { ok, fail, type Provenance } from "@/lib/data/resource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const meta: Provenance = { source: "event", kind: "api", live: true };

export function OPTIONS(req: Request): Response {
  return preflight(req);
}

// Update an event's fields and/or status. manageEvents. Setting status to PUBLISHED
// here does NOT send email/SMS — notifications stay a dashboard-only action. At
// least one field must be present. Enum literals mirror lib/events/types.ts.
const LocationSchema = z.object({
  name: z.string().trim().max(200).default(""),
  address: z.string().trim().max(300).default(""),
  city: z.string().trim().max(120).default(""),
  county: z.string().trim().max(120).default(""),
});
const UpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    type: z.enum(["rally", "town-hall", "fundraiser", "canvass", "parade", "meet-greet", "debate", "volunteer-shift", "other"]).optional(),
    start: z.string().trim().min(1).max(40).optional(),
    end: z.string().trim().max(40).nullable().optional(),
    allDay: z.boolean().optional(),
    location: LocationSchema.optional(),
    description: z.string().trim().max(5000).optional(),
    capacity: z.number().int().positive().nullable().optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update." });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { allowed, gate } = await checkCap("manageEvents");
  if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  const { id } = await params;
  if (!id) return withCors(NextResponse.json(fail("missing id", meta), { status: 400 }), req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return withCors(NextResponse.json(fail("invalid update", meta), { status: 400 }), req);
  try {
    const found = await updateEvent(id, parsed.data);
    if (!found) return withCors(NextResponse.json(fail("not found", meta), { status: 404 }), req);
    await recordExtAction({ at: new Date().toISOString(), actor: gate.email ?? "unknown", action: "event.update", target: id });
    return withCors(NextResponse.json(ok({ id }, meta)), req);
  } catch {
    return withCors(NextResponse.json(fail("could not update event", meta), { status: 502 }), req);
  }
}
