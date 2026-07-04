import { QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { bucketByDay, windowSums } from "@/lib/trends";

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

type Contribution = { amountCents: number; receivedAt?: string; election?: string };
const sumContribs = (d: Item) =>
  ((d.contributions as Contribution[] | undefined) ?? []).reduce((s, c) => s + (c.amountCents || 0), 0);

// Largest net total attributable to any single election (untagged gifts default
// to the primary). This — not the lifetime total — is what the FEC per-election
// limit applies to, so a compliant $3,500-primary + $3,500-general donor isn't
// flagged, and a real per-election overage isn't masked by refunds netting the
// lifetime total down.
const maxPerElectionCents = (d: Item) => {
  const byElection = new Map<string, number>();
  for (const c of (d.contributions as Contribution[] | undefined) ?? []) {
    const k = (c.election || "PRIMARY").toUpperCase();
    byElection.set(k, (byElection.get(k) ?? 0) + (c.amountCents || 0));
  }
  return byElection.size ? Math.max(...byElection.values()) : 0;
};

// Trailing daily series + last-7d-vs-prior-7d for a KPI tile (spark + delta).
const TREND_DAYS = 30;
function trendFor(events: { at: string; value: number }[], today: string) {
  const byDay = bucketByDay(events, { days: TREND_DAYS, today });
  return { byDay, last7: windowSums(byDay, 7) };
}

export type DonorRow = {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  employer: string | null;
  occupation: string | null;
  totalCents: number;
  maxPerElectionCents: number;
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
  zip: string | null;
  mode: string | null;
  skills: string[];
  availability: string[];
  // Structured taxonomy from the /join signup (mirrors the Airtable roster).
  roles: string[]; // Role Interests (canonical Airtable role names)
  commitment: string | null; // Commitment Level
  door: string | null; // which /join door they came through (e.g. "Team Captain")
  optedOut: boolean; // opted out of contact (email unsubscribe-all / SMS STOP)
  pledgeFulfilled: boolean; // a Donor-Pledge signup whose WinRed gift has landed
  interestedTasks: string[]; // matched tasks they raised their hand for on /community
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
  dueDate: string | null; // YYYY-MM-DD (date-only), or null when undated
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

    // Data-backed KPI trends (last 30 days). Contributions carry receivedAt;
    // donors/volunteers carry createdAt. today is stamped at request time.
    const today = new Date().toISOString().slice(0, 10);
    const contribEvents = donors.flatMap((d) =>
      ((d.contributions as Contribution[] | undefined) ?? [])
        .filter((c) => c.receivedAt)
        .map((c) => ({ at: c.receivedAt as string, value: c.amountCents || 0 })),
    );
    const createdEvents = (rows: Item[]) =>
      rows.filter((r) => r.createdAt).map((r) => ({ at: String(r.createdAt), value: 1 }));
    const trends = {
      raised: trendFor(contribEvents, today),
      donors: trendFor(createdEvents(donors), today),
      volunteers: trendFor(createdEvents(vols), today),
    };

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
      trends,
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
        maxPerElectionCents: maxPerElectionCents(d),
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
        zip: (v.zip as string) ?? null,
        mode: (v.mode as string) ?? null,
        skills: Array.isArray(v.skills) ? (v.skills as string[]) : [],
        availability: Array.isArray(v.availability) ? (v.availability as string[]) : [],
        roles: Array.isArray(v.roles) ? (v.roles as string[]) : [],
        commitment: (v.commitment as string) ?? null,
        door: (v.door as string) ?? null,
        optedOut: !!v.optedOut,
        pledgeFulfilled: !!v.pledgeFulfilledAt,
        interestedTasks: Array.isArray(v.interestedTasks) ? (v.interestedTasks as string[]) : [],
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
      zip: (v.zip as string) ?? null,
      mode: (v.mode as string) ?? null,
      skills: Array.isArray(v.skills) ? (v.skills as string[]) : [],
      availability: Array.isArray(v.availability) ? (v.availability as string[]) : [],
      roles: Array.isArray(v.roles) ? (v.roles as string[]) : [],
      commitment: (v.commitment as string) ?? null,
      door: (v.door as string) ?? null,
      optedOut: !!v.optedOut,
      pledgeFulfilled: !!v.pledgeFulfilledAt,
      interestedTasks: Array.isArray(v.interestedTasks) ? (v.interestedTasks as string[]) : [],
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
        dueDate: (t.dueDate as string) ?? null,
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

// Tasks assigned to one volunteer — powers the volunteer magic-link portal.
export async function getVolunteerTasks(volunteerId: string): Promise<TaskRow[]> {
  if (!volunteerId) return [];
  const { rows } = await getTasks();
  return rows.filter((t) => t.volunteerId === volunteerId);
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
