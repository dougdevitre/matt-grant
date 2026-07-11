"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getDonors, getVolunteers } from "@/lib/queries";
import { parseCsv } from "@/lib/contacts/import";
import { recordCanvassIds, type CanvassEntry } from "@/lib/voters/canvassStore";
import { mapReturnRows } from "@/lib/voters/chase";
import { matchPhones, type PhoneContact } from "@/lib/voters/phones";
import { mapAppendRows } from "@/lib/voters/phoneAppend";
import { listAppendedPhones, putAppendedPhones } from "@/lib/voters/phoneStore";
import { importReturns, listReturnsByPrecinct } from "@/lib/voters/returnsStore";
import { listVotersByPrecinct } from "@/lib/voters/store";
import { syncCallList, syncTurfs, type SyncResult, type TurfSummary } from "@/lib/voters/turfSync";
import type { StoredVoter } from "@/lib/voters/storeTypes";

// Server actions for the voter dashboard. viewVoterFile is ADMIN-ONLY (rbac):
// this is RSMo 115.157 data — captains get generated turf packets in Phase 4,
// never raw access. Every read re-gates server-side regardless of the UI.

async function gate(): Promise<{ ok: boolean; email: string }> {
  const g = await staffGate();
  return { ok: g.ok && can(g.role, "viewVoterFile"), email: g.ok ? (g.email ?? "") : "" };
}

async function allowed(): Promise<boolean> {
  return (await gate()).ok;
}

export type PrecinctVoters = {
  voters: StoredVoter[];
  // voterId -> votedAt ("" when the return carried no date): banked ballots for
  // this precinct. The explorer hides these from lists by default (chase doc:
  // mark banked AND remove from contact lists).
  banked: Record<string, string>;
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
  if (!(await allowed())) return { voters: [], phones: {}, banked: {} };
  const key = String(precinctKey ?? "").trim().slice(0, 120);
  if (!key) return { voters: [], phones: {}, banked: {} };
  const [voters, banked] = await Promise.all([
    listVotersByPrecinct(key),
    listReturnsByPrecinct(key).catch(() => ({}) as Record<string, string>),
  ]);
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
  return { voters, phones, banked };
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

// ── Phase 5: canvass-ID write-back ────────────────────────────────────────────

const CANVASS_CAP = 2_000;

/** Apply 1-5 canvass IDs from a returned walk sheet to one precinct: each
 *  voter's s + segment recompute from the REAL label, and the precinct's
 *  VOTERAGG rewrites so every surface (map, Targets, chase) moves. */
export async function recordCanvassIdsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await gate();
  if (!g.ok) return { ok: false, message: "Not authorized." };
  const precinctKey = String(formData.get("precinctKey") ?? "").trim().slice(0, 120);
  let entries: CanvassEntry[] = [];
  try {
    const raw: unknown = JSON.parse(String(formData.get("entries") ?? "[]"));
    if (Array.isArray(raw)) {
      entries = raw.slice(0, CANVASS_CAP).flatMap((e): CanvassEntry[] => {
        if (!e || typeof e !== "object") return [];
        const o = e as Record<string, unknown>;
        const voterId = String(o.voterId ?? "").trim().slice(0, 40);
        const canvassId = Number(o.canvassId);
        return voterId && canvassId >= 1 && canvassId <= 5 ? [{ voterId, canvassId }] : [];
      });
    }
  } catch {
    return { ok: false, message: "Couldn't read the canvass entries — reload and try again." };
  }
  if (!precinctKey || !entries.length) return { ok: false, message: "No canvass IDs to save." };
  try {
    const res = await recordCanvassIds(precinctKey, entries, g.email);
    revalidatePath("/dashboard/voters");
    const miss = res.unknownIds.length
      ? ` · ${res.unknownIds.length} unknown id${res.unknownIds.length === 1 ? "" : "s"} skipped (${res.unknownIds.slice(0, 5).join(", ")}${res.unknownIds.length > 5 ? "…" : ""})`
      : "";
    const retier = res.retiered ? ` · ${res.retiered} banked ballot${res.retiered === 1 ? "" : "s"} re-tiered on the chase board` : "";
    return { ok: true, message: `Saved ${res.updated} canvass ID${res.updated === 1 ? "" : "s"} — segments recomputed${retier}${miss}.` };
  } catch {
    return { ok: false, message: "Write-back failed — check the connection and retry." };
  }
}

/** Bulk canvass entry: paste `voterId,canvassId` lines from a returned sheet. */
export async function recordCanvassPasteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const precinctKey = String(formData.get("precinctKey") ?? "");
  const text = String(formData.get("lines") ?? "").slice(0, 200_000);
  const entries = text
    .split(/\r?\n/)
    .map((line) => {
      const [id, cid] = line.split(/[,\t]/).map((s) => (s ?? "").trim());
      return { voterId: id ?? "", canvassId: Number(cid) };
    })
    .filter((e) => e.voterId && e.canvassId >= 1 && e.canvassId <= 5);
  const fd = new FormData();
  fd.set("precinctKey", precinctKey);
  fd.set("entries", JSON.stringify(entries.slice(0, CANVASS_CAP)));
  return recordCanvassIdsAction(_prev, fd);
}

// ── Phase 5: ballot-returns import (the chase board's feed) ──────────────────

const RETURNS_CAP = 20_000;

/** Import the county's daily early-vote/absentee returns file (voter ids).
 *  Idempotent: re-importing a cumulative file only counts new ballots. */
export async function importBallotReturnsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await gate();
  if (!g.ok) return { ok: false, message: "Not authorized." };
  const text = String(formData.get("csv") ?? "").slice(0, 4_000_000);
  if (!text.trim()) return { ok: false, message: "Paste the returns CSV first." };
  const { valid, skipped, total } = mapReturnRows(parseCsv(text));
  if (total > RETURNS_CAP) return { ok: false, message: `Too many rows (${total.toLocaleString()}) — import in batches of ${RETURNS_CAP.toLocaleString()}.` };
  if (!valid.length) return { ok: false, message: `No usable rows of ${total} — each needs a voter id (header: voter_id).` };
  try {
    const res = await importReturns(valid, g.email);
    revalidatePath("/dashboard/voters/chase");
    const miss = res.unmatched.length
      ? ` · ${res.unmatched.length} unmatched id${res.unmatched.length === 1 ? "" : "s"} (${res.unmatched.slice(0, 5).join(", ")}${res.unmatched.length > 5 ? "…" : ""})`
      : "";
    const skip = skipped ? ` · ${skipped} rows had no voter id` : "";
    return {
      ok: true,
      message: `Banked ${res.banked.toLocaleString()} new ballot${res.banked === 1 ? "" : "s"} · ${res.duplicates.toLocaleString()} already recorded${miss}${skip}.`,
    };
  } catch {
    return { ok: false, message: "Import failed — check the connection and retry." };
  }
}
