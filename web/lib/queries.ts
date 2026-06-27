import { QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";

// All dashboard reads. Each entity type is one DynamoDB partition, so a Query by
// PK lists them; aggregation happens in code (campaign-scale data is small).

type Item = Record<string, unknown>;

async function queryAll(pk: string): Promise<Item[]> {
  const items: Item[] = [];
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
    items.push(...((out.Items as Item[]) ?? []));
    ExclusiveStartKey = out.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

type Contribution = { amountCents: number };
const sumContribs = (d: Item) =>
  ((d.contributions as Contribution[] | undefined) ?? []).reduce((s, c) => s + (c.amountCents || 0), 0);

export type DonorRow = {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  employer: string | null;
  occupation: string | null;
  totalCents: number;
  thankedAt: string | null;
};

export type VolunteerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  interests: string | null;
  interestTags: string[];
  notes: string | null;
  status: string;
  assignedTo: string | null;
  captainEmail: string | null;
  lastContactedAt: string | null;
  createdAt: string;
};

export type TaskRow = {
  id: string;
  title: string;
  detail: string | null;
  category: string;
  status: string;
  priority: string;
  volunteerId: string | null;
  volunteerName: string | null;
};

export type ExpenditureRow = {
  id: string;
  payee: string;
  amountCents: number;
  category: string;
  memo: string | null;
};

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export async function getOverview() {
  if (!dbConfigured) return { connected: false as const };
  try {
    const [donors, exps, vols, tasks, miles] = await Promise.all([
      queryAll(PK.donors),
      queryAll(PK.expenditures),
      queryAll(PK.volunteers),
      queryAll(PK.tasks),
      queryAll(PK.milestones),
    ]);
    const raisedCents = donors.reduce((s, d) => s + sumContribs(d), 0);
    const spentCents = exps.reduce((s, e) => s + (Number(e.amountCents) || 0), 0);
    const byStatus = (rows: Item[], status: string) => rows.filter((r) => r.status === status).length;
    const milestones = miles
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
      .map((m) => ({ id: String(m.SK), phase: String(m.phase), title: String(m.title), target: String(m.target), done: !!m.done }));
    return {
      connected: true as const,
      raisedCents,
      spentCents,
      cashOnHandCents: raisedCents - spentCents,
      donorCount: donors.length,
      volunteerTotal: vols.length,
      volActive: byStatus(vols, "ACTIVE"),
      tasksTodo: byStatus(tasks, "TODO"),
      tasksDoing: byStatus(tasks, "DOING"),
      tasksDone: byStatus(tasks, "DONE"),
      milestones,
    };
  } catch {
    return { connected: false as const };
  }
}

export async function getDonors(): Promise<{ connected: boolean; rows: DonorRow[] }> {
  if (!dbConfigured) return { connected: false, rows: [] };
  try {
    const donors = await queryAll(PK.donors);
    const rows = donors
      .map((d) => ({
        id: String(d.SK),
        name: String(d.name),
        email: (d.email as string) ?? null,
        city: (d.city as string) ?? null,
        employer: (d.employer as string) ?? null,
        occupation: (d.occupation as string) ?? null,
        totalCents: sumContribs(d),
        thankedAt: (d.thankedAt as string) ?? null,
        createdAt: String(d.createdAt ?? ""),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { connected: true, rows };
  } catch {
    return { connected: false, rows: [] };
  }
}

export async function getVolunteers(): Promise<{ connected: boolean; rows: VolunteerRow[] }> {
  if (!dbConfigured) return { connected: false, rows: [] };
  try {
    const items = await queryAll(PK.volunteers);
    const rows = items
      .map((v) => ({
        id: String(v.SK),
        name: String(v.name),
        email: (v.email as string) ?? null,
        phone: (v.phone as string) ?? null,
        city: (v.city as string) ?? null,
        interests: (v.interests as string) ?? null,
        interestTags: Array.isArray(v.interestTags) ? (v.interestTags as string[]) : [],
        notes: (v.notes as string) ?? null,
        status: String(v.status ?? "NEW"),
        assignedTo: (v.assignedTo as string) ?? null,
        captainEmail: (v.captainEmail as string) ?? null,
        lastContactedAt: (v.lastContactedAt as string) ?? null,
        createdAt: String(v.createdAt ?? ""),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { connected: true, rows };
  } catch {
    return { connected: false, rows: [] };
  }
}

export async function getVolunteer(id: string): Promise<VolunteerRow | null> {
  if (!dbConfigured || !id) return null;
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.volunteers, SK: id } }));
    const v = r.Item;
    if (!v) return null;
    return {
      id: String(v.SK),
      name: String(v.name),
      email: (v.email as string) ?? null,
      phone: (v.phone as string) ?? null,
      city: (v.city as string) ?? null,
      interests: (v.interests as string) ?? null,
      interestTags: Array.isArray(v.interestTags) ? (v.interestTags as string[]) : [],
      notes: (v.notes as string) ?? null,
      status: String(v.status ?? "NEW"),
      assignedTo: (v.assignedTo as string) ?? null,
      captainEmail: (v.captainEmail as string) ?? null,
      lastContactedAt: (v.lastContactedAt as string) ?? null,
      createdAt: String(v.createdAt ?? ""),
    };
  } catch {
    return null;
  }
}

export async function getTasks(): Promise<{ connected: boolean; rows: TaskRow[] }> {
  if (!dbConfigured) return { connected: false, rows: [] };
  try {
    const items = await queryAll(PK.tasks);
    const rows = items
      .map((t) => ({
        id: String(t.SK),
        title: String(t.title),
        detail: (t.detail as string) ?? null,
        category: String(t.category ?? "Field"),
        status: String(t.status ?? "TODO"),
        priority: String(t.priority ?? "MEDIUM"),
        volunteerId: (t.volunteerId as string) ?? null,
        volunteerName: (t.volunteerName as string) ?? null,
        createdAt: String(t.createdAt ?? ""),
      }))
      .sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1) ||
          a.createdAt.localeCompare(b.createdAt),
      );
    return { connected: true, rows };
  } catch {
    return { connected: false, rows: [] };
  }
}

export async function getFinance(): Promise<{
  connected: boolean;
  raisedCents: number;
  spentCents: number;
  expenditures: ExpenditureRow[];
  byCategory: { category: string; cents: number }[];
}> {
  if (!dbConfigured) return { connected: false, raisedCents: 0, spentCents: 0, expenditures: [], byCategory: [] };
  try {
    const [donors, exps] = await Promise.all([queryAll(PK.donors), queryAll(PK.expenditures)]);
    const expenditures = exps
      .map((e) => ({
        id: String(e.SK),
        payee: String(e.payee),
        amountCents: Number(e.amountCents) || 0,
        category: String(e.category ?? "Operations"),
        memo: (e.memo as string) ?? null,
        paidAt: String(e.paidAt ?? ""),
      }))
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
    const map = new Map<string, number>();
    for (const e of expenditures) map.set(e.category, (map.get(e.category) ?? 0) + e.amountCents);
    const byCategory = [...map.entries()].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents);
    return {
      connected: true,
      raisedCents: donors.reduce((s, d) => s + sumContribs(d), 0),
      spentCents: expenditures.reduce((s, e) => s + e.amountCents, 0),
      expenditures,
      byCategory,
    };
  } catch {
    return { connected: false, raisedCents: 0, spentCents: 0, expenditures: [], byCategory: [] };
  }
}
