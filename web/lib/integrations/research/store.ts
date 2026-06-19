import { PutCommand, GetCommand, QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK } from "@/lib/db";
import type { Candidate } from "./candidates";
import type { FecSummary, DonorProfile } from "../fec/types";
import type { StateLegRecord } from "../openstates/client";
import type { TenureTimeline } from "./timeline";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---- Candidate roster ----
export async function persistCandidates(field: Candidate[]): Promise<void> {
  const items = field.map((c) => ({
    PK: PK.candidates,
    SK: c.slug,
    type: "candidate",
    ...c,
    updatedAt: new Date().toISOString(),
  }));
  for (const batch of chunk(items, 25)) {
    await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE]: batch.map((Item) => ({ PutRequest: { Item } })) } }));
  }
}

export async function getStoredCandidates(): Promise<Candidate[]> {
  const out = await ddb.send(
    new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.candidates } }),
  );
  return (out.Items ?? []) as unknown as Candidate[];
}

// ---- FEC summaries (one item per candidate slug) ----
export async function persistFec(slug: string, summary: FecSummary): Promise<void> {
  await ddb.send(
    new PutCommand({ TableName: TABLE, Item: { PK: PK.fec, SK: slug, type: "fec", ...summary, source: "open.fec.gov" } }),
  );
}

export async function getFec(slug: string): Promise<FecSummary | null> {
  const out = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.fec, SK: slug } }));
  return (out.Item as unknown as FecSummary) ?? null;
}

export async function getAllFec(): Promise<Record<string, FecSummary>> {
  const out = await ddb.send(
    new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.fec } }),
  );
  const map: Record<string, FecSummary> = {};
  for (const it of (out.Items ?? []) as Array<FecSummary & { SK: string }>) map[it.SK] = it;
  return map;
}

// ---- FEC donor profiles (one item per candidate slug) ----
export async function persistDonorProfile(slug: string, profile: DonorProfile): Promise<void> {
  await ddb.send(
    new PutCommand({ TableName: TABLE, Item: { PK: PK.fecDonors, SK: slug, type: "fec-donors", ...profile, source: "open.fec.gov" } }),
  );
}

export async function getDonorProfile(slug: string): Promise<DonorProfile | null> {
  const out = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.fecDonors, SK: slug } }));
  return (out.Item as unknown as DonorProfile) ?? null;
}

// ---- State legislative record (Open States) ----
export async function persistStateLeg(slug: string, record: StateLegRecord): Promise<void> {
  await ddb.send(
    new PutCommand({ TableName: TABLE, Item: { PK: PK.stateLeg(slug), SK: "record", type: "state-leg", ...record, source: "openstates.org" } }),
  );
}

export async function getStateLeg(slug: string): Promise<StateLegRecord | null> {
  const out = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.stateLeg(slug), SK: "record" } }));
  return (out.Item as unknown as StateLegRecord) ?? null;
}

// ---- Tenure timeline ----
export async function persistTimeline(slug: string, timeline: TenureTimeline): Promise<void> {
  await ddb.send(
    new PutCommand({ TableName: TABLE, Item: { PK: PK.timeline(slug), SK: "tenure", type: "timeline", ...timeline } }),
  );
}

export async function getTimeline(slug: string): Promise<TenureTimeline | null> {
  const out = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.timeline(slug), SK: "tenure" } }));
  return (out.Item as unknown as TenureTimeline) ?? null;
}
