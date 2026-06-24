import { NextResponse } from "next/server";
import { loadField } from "@/lib/integrations/research/candidates";
import { getBills, type BillRecord } from "@/lib/integrations/legislative/store";
import { dbConfigured } from "@/lib/db";
import { scoreText, type BillRelevance } from "@/lib/analysis/childAct";
import { type Provenance, ok, degraded } from "@/lib/data/resource";

// CHILD Act synthesis — the family-court relevance view over the ingested
// Congress.gov record. Implements candidate/issues-to-action-data-synthesis-plan.md
// §3.1: surface the bills in the field's public legislative record that touch
// Matt's #1 priority (family-court corruption) and the CHILD Act's Title IV-D
// lever. Read-only, source-only: every returned bill carries its congress.gov
// citation; bills with no matched term or no source are dropped. Invents nothing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Subject = { slug: string; name: string; relation: string };
type RankedBill = {
  key: string;
  congress: number;
  billType: string;
  number: string;
  title: string | null;
  policyArea: string | null;
  introducedDate: string | null;
  sourceUrl: string;
  relevance: BillRelevance;
  subjects: Subject[];
};

const billKey = (b: BillRecord) => `${b.congress}#${b.billType}#${b.number}`;

export async function GET() {
  const generatedAt = new Date().toISOString();
  const note =
    "Public bills from the ingested Congress.gov record, matched to the family-court fight by keyword. " +
    "Relevance is a heuristic over each bill's own title/policy area — not a claim about its contents or any vote. Verify against the linked source.";

  const meta: Provenance = { source: "CHILD Act bills (Congress.gov)", kind: "api", live: true, fetchedAt: generatedAt };
  if (!dbConfigured) {
    return NextResponse.json(
      degraded({ generatedAt, configured: false, count: 0, byTier: { core: 0, related: 0, tangential: 0 }, bills: [], note },
        "research store not connected", meta),
    );
  }

  const field = loadField().filter((c) => c.active !== false && c.bioguideId);

  // Gather each subject's bills, then collapse to a unique bill list, merging the
  // candidates (and their sponsored/cosponsored relation) behind the same bill.
  const byBill = new Map<string, RankedBill>();
  for (const c of field) {
    const bills = await getBills(c.bioguideId as string);
    for (const b of bills) {
      const relevance = scoreText(b.title, b.policyArea);
      if (relevance.score === 0 || !b.sourceUrl) continue; // no signal or no citation
      const key = billKey(b);
      const subject: Subject = { slug: c.slug, name: c.name, relation: b.relation };
      const existing = byBill.get(key);
      if (existing) {
        if (!existing.subjects.some((s) => s.slug === c.slug && s.relation === b.relation)) {
          existing.subjects.push(subject);
        }
        continue;
      }
      byBill.set(key, {
        key,
        congress: b.congress,
        billType: b.billType,
        number: b.number,
        title: b.title,
        policyArea: b.policyArea,
        introducedDate: b.introducedDate,
        sourceUrl: b.sourceUrl,
        relevance,
        subjects: [subject],
      });
    }
  }

  const bills = [...byBill.values()].sort(
    (a, b) =>
      b.relevance.score - a.relevance.score ||
      (b.introducedDate ?? "").localeCompare(a.introducedDate ?? ""),
  );

  return NextResponse.json(
    ok(
      {
        generatedAt,
        configured: true,
        count: bills.length,
        byTier: {
          core: bills.filter((b) => b.relevance.tier === "core").length,
          related: bills.filter((b) => b.relevance.tier === "related").length,
          tangential: bills.filter((b) => b.relevance.tier === "tangential").length,
        },
        bills,
        note,
      },
      { ...meta, count: bills.length },
    ),
  );
}
