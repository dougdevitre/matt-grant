import { NextResponse } from "next/server";
import { z } from "zod";
import { extRoute } from "@/lib/http/ext-route";
import { withCors } from "@/lib/http/cors";
import { checkCap } from "@/lib/auth";
import { createEvent, listEvents } from "@/lib/events";
import { recordExtAction } from "@/lib/audit";
import { ok, fail, type Provenance } from "@/lib/data/resource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const meta: Provenance = { source: "event calendar", kind: "api", live: true };

// Read (all events incl. drafts) + OPTIONS — manageEvents (admin + captain).
export const { GET, OPTIONS } = extRoute({
  capability: "manageEvents",
  source: "event calendar",
  load: () => listEvents(),
});

// createdBy comes from the session. NOTE: creating with status PUBLISHED does NOT
// send email/SMS — the extension surface never triggers notifications (publishing-
// with-notify stays a dashboard action). The enum literals mirror EVENT_TYPES /
// EVENT_STATUSES in lib/events/types.ts.
const LocationSchema = z.object({
  name: z.string().trim().max(200).default(""),
  address: z.string().trim().max(300).default(""),
  city: z.string().trim().max(120).default(""),
  county: z.string().trim().max(120).default(""),
});
const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum(["rally", "town-hall", "fundraiser", "canvass", "parade", "meet-greet", "debate", "volunteer-shift", "other"]),
  start: z.string().trim().min(1).max(40), // ISO 8601
  end: z.string().trim().max(40).nullable().optional(),
  allDay: z.boolean().optional(),
  location: LocationSchema.optional(),
  description: z.string().trim().max(5000).default(""),
  capacity: z.number().int().positive().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]).optional(),
});

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

// POST — create an event. manageEvents.
export async function POST(req: Request): Promise<Response> {
  const { allowed, gate } = await checkCap("manageEvents");
  if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  const parsed = CreateSchema.safeParse(await readJson(req));
  if (!parsed.success) return withCors(NextResponse.json(fail("invalid event", meta), { status: 400 }), req);
  try {
    const id = await createEvent({
      ...parsed.data,
      location: parsed.data.location ?? { name: "", address: "", city: "", county: "" },
      createdBy: gate.email ?? "unknown",
    });
    await recordExtAction({ at: new Date().toISOString(), actor: gate.email ?? "unknown", action: "event.create", target: id });
    return withCors(NextResponse.json(ok({ id }, { ...meta, count: 1 })), req);
  } catch {
    return withCors(NextResponse.json(fail("could not create event", meta), { status: 502 }), req);
  }
}
