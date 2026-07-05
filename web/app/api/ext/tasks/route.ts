import { NextResponse } from "next/server";
import { z } from "zod";
import { extRoute } from "@/lib/http/ext-route";
import { withCors } from "@/lib/http/cors";
import { checkCap } from "@/lib/auth";
import { getTasks } from "@/lib/queries";
import { createTask, setTaskStatus, TASK_STATUSES } from "@/lib/tasks";
import { recordExtAction } from "@/lib/audit";
import { ok, fail, type Provenance } from "@/lib/data/resource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const meta: Provenance = { source: "task board", kind: "api", live: true };

// Read (list the board) + OPTIONS preflight — the shared factory (CORS + checkCap +
// Resource envelope). The write verbs below reuse the same gate/CORS contract.
export const { GET, OPTIONS } = extRoute({
  capability: "manageTasks",
  source: "task board",
  load: () => getTasks(),
});

// Optional fields are clamped like the dashboard's str() abuse-guard (≤2k), and
// dueDate is held to the YYYY-MM-DD shape cleanDate() enforces.
const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(100).optional(),
  priority: z.string().trim().max(50).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  volunteerId: z.string().trim().max(100).optional(),
  volunteerName: z.string().trim().max(200).optional(),
});

// The enum literals mirror TASK_STATUSES; setTaskStatus() is typed to TaskStatus,
// so a divergence would fail the build here.
const StatusSchema = z.object({
  id: z.string().trim().min(1).max(200),
  status: z.enum(["TODO", "DOING", "DONE"]),
});

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

// POST — create a task. manageTasks (all staff tiers).
export async function POST(req: Request): Promise<Response> {
  const { allowed, gate } = await checkCap("manageTasks");
  if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  const parsed = CreateSchema.safeParse(await readJson(req));
  if (!parsed.success) return withCors(NextResponse.json(fail("invalid task", meta), { status: 400 }), req);
  try {
    const id = await createTask(parsed.data);
    await recordExtAction({ at: new Date().toISOString(), actor: gate.email ?? "unknown", action: "task.create", target: id });
    return withCors(NextResponse.json(ok({ id }, { ...meta, count: 1 })), req);
  } catch {
    return withCors(NextResponse.json(fail("could not create task", meta), { status: 502 }), req);
  }
}

// PATCH — move a task to a new lifecycle status. manageTasks (all staff tiers).
export async function PATCH(req: Request): Promise<Response> {
  const { allowed, gate } = await checkCap("manageTasks");
  if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  const parsed = StatusSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return withCors(
      NextResponse.json(fail(`invalid status (want id + one of ${TASK_STATUSES.join("/")})`, meta), { status: 400 }),
      req,
    );
  }
  try {
    const updated = await setTaskStatus(parsed.data.id, parsed.data.status);
    if (!updated) return withCors(NextResponse.json(fail("task not found", meta), { status: 404 }), req);
    await recordExtAction({ at: new Date().toISOString(), actor: gate.email ?? "unknown", action: "task.status", target: parsed.data.id });
    return withCors(NextResponse.json(ok({ id: parsed.data.id, status: parsed.data.status }, meta)), req);
  } catch {
    return withCors(NextResponse.json(fail("could not update task", meta), { status: 502 }), req);
  }
}
