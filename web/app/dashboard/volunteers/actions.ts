"use server";

import { revalidatePath } from "next/cache";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { parseCsv, mapVolunteers } from "@/lib/contacts/import";

export type ImportState = { ok: boolean; message: string; imported?: number; skipped?: number };

const MAX_ROWS = 5000;

// Bulk-import volunteers from pasted CSV. Upserts on the same dedupe key as the
// public intake (e:<email> / p:<phone> / random), so re-importing a known contact
// updates rather than duplicates, and an existing ACTIVE volunteer keeps status +
// createdAt. Same field shape as app/(site)/contact/actions.ts; source = "import".
export async function importVolunteers(_prev: ImportState | null, formData: FormData): Promise<ImportState> {
  const { role } = await staffGate();
  if (!can(role, "manageVolunteers")) return { ok: false, message: "Not allowed." };
  if (!dbConfigured) return { ok: false, message: "Database not connected." };

  const text = String(formData.get("csv") ?? "");
  const { valid, skipped } = mapVolunteers(parseCsv(text));
  if (valid.length === 0) {
    return { ok: false, message: `No importable rows. Include a header row with at least name and email or phone.${skipped ? ` (${skipped} rows skipped.)` : ""}` };
  }

  const now = new Date().toISOString();
  let imported = 0;
  for (const v of valid.slice(0, MAX_ROWS)) {
    const dedupeKey = v.email ? `e:${v.email}` : v.phone ? `p:${v.phone.replace(/\D/g, "")}` : newId();
    const interestTags = (v.interests ?? "").split(/[,;]/).map((t) => t.trim()).filter(Boolean).slice(0, 12);
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: PK.volunteers, SK: dedupeKey },
          UpdateExpression:
            "SET #n = :n, email = :em, phone = :ph, city = :ci, interests = :in, interestTags = :tags, " +
            "#src = :src, updatedAt = :u, #st = if_not_exists(#st, :new), createdAt = if_not_exists(createdAt, :u)",
          ExpressionAttributeNames: { "#n": "name", "#st": "status", "#src": "source" },
          ExpressionAttributeValues: {
            ":n": v.name,
            ":em": v.email ?? null,
            ":ph": v.phone ?? null,
            ":ci": v.city ?? null,
            ":in": v.interests ?? null,
            ":tags": interestTags,
            ":src": "import",
            ":u": now,
            ":new": "NEW",
          },
        }),
      );
      imported++;
    } catch {
      /* one bad row shouldn't fail the batch */
    }
  }
  revalidatePath("/dashboard/volunteers");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Imported ${imported} volunteer${imported === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} (missing name or contact)` : ""}.`,
    imported,
    skipped,
  };
}
