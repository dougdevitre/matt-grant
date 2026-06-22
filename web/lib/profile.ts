import { GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { ISSUE_IDS, isIssueId, type IssueId } from "@/lib/integrations/research/issues";

// Supporter involvement profile — the queryable CRM that drives personalization,
// targeted email, and volunteer matching (see the metadata plan). Kept in
// DynamoDB, NOT Clerk metadata: it's segmentation data that can grow and must stay
// out of the OAuth-exposed publicMetadata. Keyed by lowercased email.
//
// Phase 1 captures the essentials; the field list can extend without migration.

export const WAYS_TO_HELP = ["donate", "volunteer", "host", "share", "yardSign", "writeLetters"] as const;
export type WayToHelp = (typeof WAYS_TO_HELP)[number];
const WAY_SET = new Set<string>(WAYS_TO_HELP);
export const isWayToHelp = (v: unknown): v is WayToHelp => typeof v === "string" && WAY_SET.has(v);

export type SupporterProfile = {
  issues: IssueId[]; // the priorities they care about → personalized content / targeted email
  waysToHelp: WayToHelp[]; // how they want to help → volunteer/field matching
  zip?: string; // → county / precinct for local action
  onboardedAt?: string;
  updatedAt?: string;
};

const norm = (e: string) => e.trim().toLowerCase();
const EMPTY: SupporterProfile = { issues: [], waysToHelp: [] };

// US 5-digit zip only; anything else is dropped (we never store malformed input).
const cleanZip = (z?: string | null): string | undefined => {
  const m = (z ?? "").trim().match(/^\d{5}/);
  return m ? m[0] : undefined;
};

export async function getProfile(email?: string | null): Promise<SupporterProfile | null> {
  if (!dbConfigured || !email) return null;
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.profile, SK: norm(email) } }));
    if (!r.Item) return null;
    return {
      issues: Array.isArray(r.Item.issues) ? (r.Item.issues as string[]).filter(isIssueId) : [],
      waysToHelp: Array.isArray(r.Item.waysToHelp) ? (r.Item.waysToHelp as string[]).filter(isWayToHelp) : [],
      zip: typeof r.Item.zip === "string" ? r.Item.zip : undefined,
      onboardedAt: r.Item.onboardedAt ? String(r.Item.onboardedAt) : undefined,
      updatedAt: r.Item.updatedAt ? String(r.Item.updatedAt) : undefined,
    };
  } catch {
    return null;
  }
}

// Upsert the profile from (untrusted) form input — every field is validated/
// normalized to a known value before it's stored. Stamps onboardedAt on first save.
export async function saveProfile(
  email: string,
  input: { issues?: unknown[]; waysToHelp?: unknown[]; zip?: string | null },
): Promise<void> {
  if (!dbConfigured) return;
  const issues = (input.issues ?? []).filter((v): v is IssueId => typeof v === "string" && isIssueId(v));
  const waysToHelp = (input.waysToHelp ?? []).filter(isWayToHelp);
  const zip = cleanZip(input.zip);
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.profile, SK: norm(email) },
      UpdateExpression:
        "SET issues = :i, waysToHelp = :w, updatedAt = :u, onboardedAt = if_not_exists(onboardedAt, :u)" +
        (zip ? ", zip = :z" : ""),
      ExpressionAttributeValues: { ":i": issues, ":w": waysToHelp, ":u": now, ...(zip ? { ":z": zip } : {}) },
    }),
  );
}

// The full option lists, for rendering the onboarding/preferences UI.
export const ALL_ISSUES = ISSUE_IDS;

// ───────────────────────── targeting / segmentation ─────────────────────────
// Emails of supporters whose profile matches a segment — for targeted broadcasts.
// Reads all PROFILE rows and filters in memory (fine at campaign scale; add a GSI
// if this list grows large). Opt-out/suppression is applied LATER at send time by
// the campaign drain — this just selects by interest.
export async function segmentEmails(filter: { issue?: IssueId; wayToHelp?: WayToHelp }): Promise<string[]> {
  if (!dbConfigured) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.profile } }),
    );
    return (r.Items ?? [])
      .filter((i) => {
        if (filter.issue && !(Array.isArray(i.issues) && (i.issues as string[]).includes(filter.issue))) return false;
        if (filter.wayToHelp && !(Array.isArray(i.waysToHelp) && (i.waysToHelp as string[]).includes(filter.wayToHelp))) return false;
        return true;
      })
      .map((i) => String(i.SK).toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Supporter count per issue — for the targeting UI ("Family courts · 42").
export async function issueSegmentCounts(): Promise<Record<string, number>> {
  if (!dbConfigured) return {};
  try {
    const r = await ddb.send(
      new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.profile } }),
    );
    const counts: Record<string, number> = {};
    for (const it of r.Items ?? []) {
      const issues = Array.isArray(it.issues) ? (it.issues as string[]) : [];
      for (const iss of issues) if (isIssueId(iss)) counts[iss] = (counts[iss] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}
