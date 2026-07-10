"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { filterNew, sanitizePlacement } from "@/lib/signs/persistence";
import {
  createSignPlacements,
  deleteSignPlacement,
  listSignPlacements,
  updateSignPlacement,
  type SignPlacementPatch,
} from "@/lib/signs/store";

// Server actions for persisted sign placements. Reads stay viewTargets (all
// staff); every write here re-checks manageSigns (admin/captain) regardless of
// what the UI rendered. Modeled on app/dashboard/events/actions.ts.

const MAX_SAVE_ROWS = 1000;

async function gate(): Promise<{ email: string } | null> {
  const g = await staffGate();
  if (!g.ok || !can(g.role, "manageSigns")) return null;
  return { email: g.email ?? "" };
}

function refresh() {
  revalidatePath("/dashboard/signs");
}

export type SignsSaveState = { ok: boolean; message: string };

/** Save the tool's current UNSAVED rows (client-filtered, re-checked server-side). */
export async function saveSignPlacementsAction(_prev: SignsSaveState, formData: FormData): Promise<SignsSaveState> {
  const g = await gate();
  if (!g) return { ok: false, message: "Not allowed." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { ok: false, message: "Couldn't read the rows to save." };
  }
  if (!Array.isArray(parsed)) return { ok: false, message: "Couldn't read the rows to save." };
  if (parsed.length > MAX_SAVE_ROWS) return { ok: false, message: `Too many rows — save at most ${MAX_SAVE_ROWS} at a time.` };

  const rows = parsed.map(sanitizePlacement).filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return { ok: false, message: "Nothing new to save." };

  try {
    // Re-dedupe against what's saved NOW — the client filter is a convenience,
    // this is the guarantee (double-click, stale tab, re-pasted CSV → no-op).
    const existing = await listSignPlacements();
    const fresh = filterNew(existing, rows);
    const saved = await createSignPlacements(fresh, g.email);
    refresh();
    const skipped = rows.length - fresh.length;
    return {
      ok: true,
      message: `Saved ${saved} new location${saved === 1 ? "" : "s"}${skipped ? ` · skipped ${skipped} already saved` : ""}.`,
    };
  } catch {
    return { ok: false, message: "Couldn't save. Check the database connection." };
  }
}

// The three verification gates a row form may flip — anything else in the `gate`
// field is ignored (never write a caller-supplied attribute name).
const GATE_FIELDS = ["inDistrict", "bufferVerified", "propertyPermission"] as const;
type GateField = (typeof GATE_FIELDS)[number];

/** Flip one verification gate on a saved placement. */
export async function setSignGate(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const id = String(formData.get("id") ?? "").trim();
  const field = String(formData.get("gate") ?? "");
  if (!id || !GATE_FIELDS.includes(field as GateField)) return;
  const value = String(formData.get("value") ?? "") === "true";
  await updateSignPlacement(id, { [field]: value } as SignPlacementPatch, g.email);
  refresh();
}

/** Assign/clear the servicing captain on a saved placement. */
export async function setSignCaptain(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const captainId = String(formData.get("captainId") ?? "").trim().slice(0, 160);
  await updateSignPlacement(id, { captainId: captainId || undefined }, g.email);
  refresh();
}

/** Update the operational notes on a saved placement. */
export async function setSignNotes(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);
  await updateSignPlacement(id, { notes: notes || undefined }, g.email);
  refresh();
}

/** Remove a placement saved in error (hard delete). */
export async function removeSignPlacement(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await deleteSignPlacement(id);
  refresh();
}
