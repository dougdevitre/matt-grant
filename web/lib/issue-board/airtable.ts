// Bridge to the campaign's "Matt Grant for Congress - Issues" base — the moderated
// bulletin board where supporters submit the topics that matter to them. Mirrors
// lib/influencers/airtable.ts: server-only, uses getSecret("AIRTABLE_API_KEY"),
// degrades to empty/no-op when the key is absent (keyless builds) or the token
// lacks access. The twist here is a WRITE path (public submissions land as
// Status="Pending") plus a READ path that only ever returns Status="Approved"
// rows — so nothing is public until a human approves it inside Airtable.
//
// Required Airtable fields on the table (create these once in the base UI):
//   Topic         — Single line text  (primary field; the headline)
//   Details       — Long text         (why it matters)
//   Submitter Name— Single line text  (private; never shown publicly)
//   City          — Single line text  (private)
//   Email         — Email             (private; campaign follow-up only)
//   Phone         — Phone / single line text (private)
//   SMS Opt-In    — Checkbox
//   Status        — Single select: Pending · Approved · Rejected  (new rows = Pending)
import { getSecret } from "@/lib/ssm";

// Defaults to the Issues base + table Doug created; override via env if they move.
const BASE_ID = process.env.AIRTABLE_ISSUES_BASE_ID || "appbfBEbX8XH3bv4w";
const TABLE_ID = process.env.AIRTABLE_ISSUES_TABLE_ID || "tbl63kV5OGFj5bD6c";
const API = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

export type IssueSubmission = {
  topic: string;
  details: string;
  name?: string;
  city?: string;
  email?: string;
  phone?: string;
  smsOptIn?: boolean;
};

// What the public board renders. Deliberately omits name/city/email/phone — those
// stay in Airtable for the campaign only (submitters were told posts are anonymous).
export type PublishedTopic = {
  id: string;
  topic: string;
  details: string;
  submittedAt: string; // YYYY-MM-DD or ""
};

type AirtableRecord = { id: string; createdTime?: string; fields: Record<string, unknown> };
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** True when the Airtable source is configured (drives empty-state + form copy). */
export async function issueBoardConfigured(): Promise<boolean> {
  return Boolean(await getSecret("AIRTABLE_API_KEY"));
}

/**
 * Write a public submission as Status="Pending". THROWS on failure (no key, bad
 * field, Airtable down) so the server action can surface an honest error instead
 * of silently swallowing a supporter's voice. typecast lets Airtable resolve the
 * "Pending" select option by name.
 */
export async function createSubmission(s: IssueSubmission): Promise<void> {
  const key = await getSecret("AIRTABLE_API_KEY");
  if (!key) throw new Error("AIRTABLE_API_KEY not configured");
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      typecast: true,
      fields: {
        Topic: s.topic,
        Details: s.details,
        "Submitter Name": s.name || "",
        City: s.city || "",
        Email: s.email || "",
        Phone: s.phone || "",
        "SMS Opt-In": Boolean(s.smsOptIn),
        Status: "Pending",
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Airtable create failed: ${res.status} ${body.slice(0, 200)}`);
  }
}

/**
 * Approved topics for the public bulletin board. Filters to Status="Approved"
 * server-side, sorts newest-first by Airtable's createdTime (no dependency on a
 * custom date field), and caps the list. Returns { configured, topics }; topics
 * is [] on missing key or any error so the page never throws. Cached ~5 min.
 */
export async function listPublishedTopics(
  limit = 60,
): Promise<{ configured: boolean; topics: PublishedTopic[] }> {
  const key = await getSecret("AIRTABLE_API_KEY");
  if (!key) return { configured: false, topics: [] };
  try {
    const params = new URLSearchParams({
      pageSize: String(Math.min(limit, 100)),
      filterByFormula: "{Status} = 'Approved'",
    });
    const res = await fetch(`${API}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return { configured: true, topics: [] };
    const data = (await res.json()) as { records?: AirtableRecord[] };
    const topics = (data.records ?? [])
      .map((rec): PublishedTopic | null => {
        const topic = str(rec.fields["Topic"]);
        if (!topic) return null; // skip blank/incomplete rows
        return {
          id: rec.id,
          topic,
          details: str(rec.fields["Details"]),
          submittedAt: (rec.createdTime ?? "").slice(0, 10),
        };
      })
      .filter((t): t is PublishedTopic => t != null)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return { configured: true, topics };
  } catch {
    return { configured: true, topics: [] };
  }
}
