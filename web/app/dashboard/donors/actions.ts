"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dbConfigured } from "@/lib/db";
import { recordContribution, markThanked } from "@/lib/donors";
import { parseCsv, mapDonors } from "@/lib/contacts/import";
import { sesEnabled, sendEmail } from "@/lib/email/send";
import { donorThankYouEmail } from "@/lib/email/donorThankYou";

export type DonorImportState = { ok: boolean; message: string; imported?: number; skipped?: number };
export type ThankState = { ok: boolean; message: string };

// Send a one-off thank-you to a single donor, then mark them thanked. Admin-only.
// Idempotent at the UI (the button disables once thanked); re-sends are harmless.
export async function sendDonorThankYou(_prev: ThankState | null, formData: FormData): Promise<ThankState> {
  const { role } = await staffGate();
  if (!can(role, "viewDonorDetail")) return { ok: false, message: "Not allowed." };
  const id = String(formData.get("id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !email) return { ok: false, message: "No email on file for this donor." };
  if (!sesEnabled) return { ok: false, message: "Email isn't configured yet (set SES_FROM)." };
  const { subject, html, text } = donorThankYouEmail(name);
  const res = await sendEmail({ to: email, subject, html, text });
  if (!res.sent) return { ok: false, message: "Couldn't send — check email settings." };
  await markThanked(id);
  revalidatePath("/dashboard/donors");
  return { ok: true, message: `Thank-you sent to ${email}.` };
}

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

  // Deterministic per-row idempotency key so re-submitting the SAME CSV (a double
  // click, a network retry, or a re-paste) doesn't append every gift a second time.
  // recordContribution only engages its atomic `seenIds` dedup when an externalId is
  // present; without one, the bulk-import path double-counted on resubmit — and a
  // doubled total can falsely trip a donor's FEC over-limit flag. The key hashes the
  // row's identifying fields; a per-content occurrence counter keeps two genuinely
  // identical rows in one file as two distinct gifts and makes the key stable under
  // row reordering, so only an exact re-import collapses.
  const seen = new Map<string, number>();
  const rowExternalId = (d: (typeof valid)[number]): string => {
    const content = [d.name, d.email, d.city, d.state, d.zip, d.employer, d.occupation, d.amountCents ?? 0]
      .map((x) => String(x ?? "").trim().toLowerCase())
      .join("|");
    const h = createHash("sha256").update(content).digest("hex").slice(0, 24);
    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    return `import:${h}:${n}`;
  };

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
        externalId: rowExternalId(d),
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
