import { PutCommand, GetCommand, QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK } from "@/lib/db";
import type { NormalizedDataset } from "./types";

function parseDate(s?: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const pad = (n: number) => String(n).padStart(4, "0");

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Idempotent persistence — items keyed by stable PK/SK so re-runs upsert.
export async function persist(dataset: NormalizedDataset): Promise<void> {
  const { bioguideId, member } = dataset;

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: PK.legislators, SK: bioguideId, ...member, source: "congress.gov", updatedAt: new Date().toISOString() },
    }),
  );

  const items = [
    ...dataset.votes.map((v) => ({
      PK: PK.votes(bioguideId),
      SK: `${v.year}#${pad(v.rollNumber)}`,
      type: "vote",
      ...v,
      voteDate: parseDate(v.voteDate),
      source: "clerk.house.gov",
    })),
    ...[...dataset.sponsored, ...dataset.cosponsored].map((b) => ({
      PK: PK.bills(bioguideId),
      SK: `${b.relation}#${b.congress}#${b.billType}#${b.number}`,
      type: "bill",
      ...b,
      introducedDate: parseDate(b.introducedDate),
      source: "congress.gov",
    })),
  ];

  for (const batch of chunk(items, 25)) {
    await ddb.send(
      new BatchWriteCommand({ RequestItems: { [TABLE]: batch.map((Item) => ({ PutRequest: { Item } })) } }),
    );
  }
}

// ---- Read helpers (explicit types so the UI type-checks) ----

export type MemberRecord = { bioguideId: string; name: string; party: string | null; state: string | null; district: string | null };
export type VoteRecord = {
  id: string; year: number; rollNumber: number; position: string | null;
  question: string | null; result: string | null; legisNum: string | null; voteDate: string | null; sourceUrl: string;
};
export type BillRecord = {
  id: string; relation: string; congress: number; billType: string; number: string;
  title: string | null; policyArea: string | null; introducedDate: string | null; sourceUrl: string;
};
export type IngestRecord = { ok: boolean; startedAt: string; finishedAt?: string; counts?: unknown; error?: string };

export async function getMember(bioguideId: string): Promise<MemberRecord | null> {
  const out = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.legislators, SK: bioguideId } }));
  const m = out.Item;
  if (!m) return null;
  return {
    bioguideId,
    name: String(m.name ?? bioguideId),
    party: (m.party as string) ?? null,
    state: (m.state as string) ?? null,
    district: (m.district as string) ?? null,
  };
}

async function queryAll(pk: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const out = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ExclusiveStartKey,
      }),
    );
    items.push(...((out.Items as Record<string, unknown>[]) ?? []));
    ExclusiveStartKey = out.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

export async function getVotes(bioguideId: string, opts: { year?: number; position?: string } = {}): Promise<VoteRecord[]> {
  let votes = await queryAll(PK.votes(bioguideId));
  if (opts.year) votes = votes.filter((v) => Number(v.year) === opts.year);
  if (opts.position) votes = votes.filter((v) => v.position === opts.position);
  return votes
    .map((v) => ({
      id: String(v.SK),
      year: Number(v.year),
      rollNumber: Number(v.rollNumber),
      position: (v.position as string) ?? null,
      question: (v.question as string) ?? null,
      result: (v.result as string) ?? null,
      legisNum: (v.legisNum as string) ?? null,
      voteDate: (v.voteDate as string) ?? null,
      sourceUrl: String(v.sourceUrl ?? ""),
    }))
    .sort((a, b) => b.id.localeCompare(a.id));
}

export async function getBills(bioguideId: string, opts: { relation?: string; policyArea?: string } = {}): Promise<BillRecord[]> {
  let bills = await queryAll(PK.bills(bioguideId));
  if (opts.relation) bills = bills.filter((b) => b.relation === opts.relation);
  if (opts.policyArea) bills = bills.filter((b) => b.policyArea === opts.policyArea);
  return bills.map((b) => ({
    id: String(b.SK),
    relation: String(b.relation ?? ""),
    congress: Number(b.congress),
    billType: String(b.billType ?? ""),
    number: String(b.number ?? ""),
    title: (b.title as string) ?? null,
    policyArea: (b.policyArea as string) ?? null,
    introducedDate: (b.introducedDate as string) ?? null,
    sourceUrl: String(b.sourceUrl ?? ""),
  }));
}

export async function lastIngest(target: string): Promise<IngestRecord | null> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": PK.ingestRuns(target) },
      ScanIndexForward: false,
      Limit: 1,
    }),
  );
  const r = out.Items?.[0];
  if (!r) return null;
  return { ok: !!r.ok, startedAt: String(r.startedAt), finishedAt: r.finishedAt as string, counts: r.counts, error: r.error as string };
}
