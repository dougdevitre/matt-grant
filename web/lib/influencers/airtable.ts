// Read-only bridge to the campaign's "Influential Voters" table in the Master
// Database base — the no-code worklist of elected officials & community leaders
// who received Matt's CHILD Protection Act mailing. Mirrors lib/events/airtable.ts:
// server-only, uses getSecret("AIRTABLE_API_KEY"), caches ~15 min, and degrades
// to an empty list when the key is absent (keyless builds) or the token lacks
// access to this base. The dashboard /influencers page renders the result.
import { getSecret } from "@/lib/ssm";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";

// Master Database base + Influential Voters table, from the central registry.
// Env-overridable if they ever move; one workspace token reads every base.
const BASE_ID = process.env.AIRTABLE_INFLUENCERS_BASE_ID || AIRTABLE_BASES.masterDb.id;
const TABLE_ID = process.env.AIRTABLE_INFLUENCERS_TABLE_ID || AIRTABLE_BASES.masterDb.tables.influentialVoters;

export type InfluencerRow = {
  id: string;
  name: string;
  title: string;
  org: string;
  segment: string;
  stage: string;
  influence: number; // 0–5 rating
  outcome: string;
  email: string;
  phone: string;
  url: string;
  nextAction: string;
  followUp: string; // YYYY-MM-DD or ""
};

type AirtableRecord = { id: string; fields: Record<string, unknown> };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function recordToRow(rec: AirtableRecord): InfluencerRow | null {
  const f = rec.fields;
  const name = str(f["Name"]);
  if (!name) return null; // skip blank/incomplete rows
  const influenceRaw = f["Influence Score"];
  return {
    id: rec.id,
    name,
    title: str(f["Title"]),
    org: str(f["Organization"]),
    segment: str(f["Segment"]),
    stage: str(f["Outreach Stage"]),
    influence: typeof influenceRaw === "number" ? influenceRaw : 0,
    outcome: str(f["Outcome"]),
    email: str(f["Email"]),
    phone: str(f["Phone"]),
    url: str(f["Official Contact URL"]),
    nextAction: str(f["Next Action"]),
    followUp: str(f["Follow-up Date"]).slice(0, 10),
  };
}

/** True when the Airtable source is configured (drives the empty-state copy). */
export async function influencersConfigured(): Promise<boolean> {
  return Boolean(await getSecret("AIRTABLE_API_KEY"));
}

/**
 * All influencers from Airtable, mapped + sorted by Influence Score (desc),
 * then name. Returns { configured, rows }; rows is [] on missing key or error
 * so the page never throws. The table holds ~58 rows, well under one page.
 */
export async function listInfluencers(): Promise<{ configured: boolean; rows: InfluencerRow[] }> {
  const key = await getSecret("AIRTABLE_API_KEY");
  if (!key) return { configured: false, rows: [] };
  try {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?pageSize=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 900 },
    });
    if (!res.ok) return { configured: true, rows: [] };
    const data = (await res.json()) as { records?: AirtableRecord[] };
    const rows = (data.records ?? [])
      .map(recordToRow)
      .filter((r): r is InfluencerRow => r != null)
      .sort((a, b) => b.influence - a.influence || a.name.localeCompare(b.name));
    return { configured: true, rows };
  } catch {
    return { configured: true, rows: [] };
  }
}
