"use server";

import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getDonors, getVolunteers } from "@/lib/queries";
import { parseCsv } from "@/lib/contacts/import";
import { matchPhones, type PhoneContact } from "@/lib/voters/phones";
import { mapAppendRows } from "@/lib/voters/phoneAppend";
import { listAppendedPhones, putAppendedPhones } from "@/lib/voters/phoneStore";
import { listVotersByPrecinct } from "@/lib/voters/store";
import { syncCallList, syncTurfs, type SyncResult, type TurfSummary } from "@/lib/voters/turfSync";
import type { StoredVoter } from "@/lib/voters/storeTypes";

// Server actions for the voter dashboard. viewVoterFile is ADMIN-ONLY (rbac):
// this is RSMo 115.157 data — captains get generated turf packets in Phase 4,
// never raw access. Every read re-gates server-side regardless of the UI.

async function allowed(): Promise<boolean> {
  const g = await staffGate();
  return g.ok && can(g.role, "viewVoterFile");
}

export type PrecinctVoters = {
  voters: StoredVoter[];
  // voterId → phone matched from campaign records (volunteers/donors who gave
  // us their number, plus any imported vendor append), name+ZIP5 unless the
  // append row carries the exact Voter ID. MANUAL-DIAL call sheets only —
  // texting stays consent-ledger-gated (voter-file-plan.md §6).
  phones: Record<string, string>;
};

/** All voters in one precinct shard (bounded — a few thousand rows) plus
 *  matched phones. The explorer filters, cuts walk turfs, and builds the
 *  RSMo-stamped CSVs client-side from this. */
export async function fetchPrecinctVoters(precinctKey: string): Promise<PrecinctVoters> {
  if (!(await allowed())) return { voters: [], phones: {} };
  const key = String(precinctKey ?? "").trim().slice(0, 120);
  if (!key) return { voters: [], phones: {} };
  const voters = await listVotersByPrecinct(key);
  let phones: Record<string, string> = {};
  try {
    const [vols, donors, appended] = await Promise.all([getVolunteers(), getDonors(), listAppendedPhones()]);
    const contacts: PhoneContact[] = [
      ...vols.rows.map((v) => ({ name: v.name, zip: v.zip, phone: v.phone })),
      ...donors.rows.map((d) => ({ name: d.name, zip: d.zip, phone: d.phone })),
      // Name+zip append rows join the same conservative pool (ambiguity drops).
      ...appended.filter((a) => !a.voterId && a.name).map((a) => ({ name: a.name!, zip: a.zip, phone: a.phone })),
    ];
    phones = matchPhones(voters, contacts);
    // Voter-ID-keyed append rows are exact — they win over any name+zip match.
    const byId = new Map(appended.filter((a) => a.voterId).map((a) => [a.voterId!, a.phone]));
    for (const v of voters) {
      const p = byId.get(v.voterId);
      if (p) phones[v.voterId] = p;
    }
  } catch {
    // Best-effort: no matches beats no voters.
  }
  return { voters, phones };
}

// ── Airtable sync (Canvass Turf + Contact Lists) ──────────────────────────────

export type ActionState = { ok: boolean; message: string };

const fmt = (label: string, r: SyncResult) =>
  r.ok ? `${label}: created ${r.created} · updated ${r.updated}` : `${label}: ${r.reason}`;

/** Push the CURRENT cut turfs (summaries only — never voter PII) and the matched-
 *  phone call-list count to the Airtable field-ops tables. Fail-closed per the
 *  base's Front-End Access table; result reported honestly either way. */
export async function syncTurfsToAirtableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await allowed())) return { ok: false, message: "Not authorized." };
  const precinctLabel = String(formData.get("precinctLabel") ?? "").trim().slice(0, 80);
  const filtersLabel = String(formData.get("filtersLabel") ?? "all voters").trim().slice(0, 160);
  const matched = Math.max(0, Math.min(1_000_000, Number(formData.get("matched")) || 0));
  let turfs: TurfSummary[] = [];
  try {
    const raw: unknown = JSON.parse(String(formData.get("turfs") ?? "[]"));
    if (Array.isArray(raw)) {
      turfs = raw.slice(0, 200).flatMap((t): TurfSummary[] => {
        if (!t || typeof t !== "object") return [];
        const o = t as Record<string, unknown>;
        const n = (v: unknown) => Math.max(0, Math.min(1_000_000, Number(v) || 0));
        return [
          {
            index: n(o.index),
            total: n(o.total),
            doors: n(o.doors),
            voters: n(o.voters),
            ...(typeof o.captainName === "string" && o.captainName.trim()
              ? { captainName: o.captainName.trim().slice(0, 80) }
              : {}),
          },
        ];
      });
    }
  } catch {
    return { ok: false, message: "Couldn't read the turf summaries — reload and try again." };
  }
  if (!precinctLabel || !turfs.length) return { ok: false, message: "Nothing to sync — cut turfs first." };

  const turfResult = await syncTurfs({ precinctLabel, filtersLabel, turfs });
  const parts = [fmt("Canvass Turf", turfResult)];
  if (matched > 0) {
    parts.push(fmt("Contact Lists", await syncCallList({ precinctLabel, filtersLabel, records: matched })));
  }
  return { ok: turfResult.ok, message: parts.join(" · ") };
}

// ── Vendor phone-append import ────────────────────────────────────────────────

const APPEND_CAP = 10_000;

/** Import a pasted vendor phone-append CSV (voter_id OR name+zip, + phone).
 *  Rows land in the VOTERPHONE partition and feed call sheets/CSVs only —
 *  never SMS (TCPA: texting requires the person's own opt-in). */
export async function importAppendedPhonesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await allowed())) return { ok: false, message: "Not authorized." };
  const text = String(formData.get("csv") ?? "").slice(0, 4_000_000);
  const source = String(formData.get("source") ?? "").trim().slice(0, 60) || "vendor-append";
  if (!text.trim()) return { ok: false, message: "Paste the append CSV first." };
  const { valid, skipped, total } = mapAppendRows(parseCsv(text), source);
  if (total > APPEND_CAP) return { ok: false, message: `Too many rows (${total.toLocaleString()}) — import in batches of ${APPEND_CAP.toLocaleString()}.` };
  if (!valid.length) {
    return { ok: false, message: `No usable rows of ${total} — each needs a phone plus a Voter ID or a name + 5-digit ZIP.` };
  }
  try {
    const written = await putAppendedPhones(valid);
    const reasons = skipped.length
      ? ` · skipped ${skipped.length} (${[...new Set(skipped.map((s) => s.reason))].join("; ")})`
      : "";
    return { ok: true, message: `Imported ${written} appended phone${written === 1 ? "" : "s"}${reasons}. Call sheets only — never texted.` };
  } catch {
    return { ok: false, message: "Database write failed — check the connection and retry." };
  }
}
