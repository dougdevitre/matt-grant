"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dbConfigured } from "@/lib/db";
import { recordContribution } from "@/lib/donors";
import { parseCsv, mapDonors } from "@/lib/contacts/import";

export type DonorImportState = { ok: boolean; message: string; imported?: number; skipped?: number };

const MAX_ROWS = 5000;

// Bulk-import donors from pasted CSV. Funnels each row through recordContribution
// (the same FEC-aware, email-keyed upsert the WinRed webhook + manual form use):
// returning donors accumulate on one row, employer/occupation are preserved, and a
// row with no amount just creates/updates the donor contact (no gift logged).
// Admin-only (viewDonorDetail).
export async function importDonors(_prev: DonorImportState | null, formData: FormData): Promise<DonorImportState> {
  const { role } = await staffGate();
  if (!can(role, "viewDonorDetail")) return { ok: false, message: "Only admins can import donors." };
  if (!dbConfigured) return { ok: false, message: "Database not connected." };

  const { valid, skipped } = mapDonors(parseCsv(String(formData.get("csv") ?? "")));
  if (valid.length === 0) {
    return { ok: false, message: `No importable rows. Include a header row with at least a name column.${skipped ? ` (${skipped} rows skipped.)` : ""}` };
  }

  let imported = 0;
  for (const d of valid.slice(0, MAX_ROWS)) {
    try {
      await recordContribution({
        name: d.name,
        email: d.email,
        city: d.city,
        state: d.state,
        zip: d.zip,
        employer: d.employer,
        occupation: d.occupation,
        amountCents: d.amountCents ?? 0,
        method: "Import",
        source: "import",
      });
      imported++;
    } catch {
      /* one bad row shouldn't fail the batch */
    }
  }
  revalidatePath("/dashboard/donors");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Imported ${imported} donor${imported === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} (missing name)` : ""}.`,
    imported,
    skipped,
  };
}
