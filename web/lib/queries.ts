import { prisma, dbConfigured } from "@/lib/db";

// All dashboard reads go through here so a missing/unreachable DB degrades to
// empty state instead of crashing the page. Returns `connected: false` when
// DATABASE_URL is unset or the query throws.

export type DonorRow = {
  id: string;
  name: string;
  city: string | null;
  employer: string | null;
  occupation: string | null;
  totalCents: number;
};

export async function getOverview() {
  if (!dbConfigured) return { connected: false as const };
  try {
    const [donorCount, contribs, volunteers, tasks, milestones] = await Promise.all([
      prisma.donor.count(),
      prisma.contribution.aggregate({ _sum: { amountCents: true } }),
      prisma.volunteer.groupBy({ by: ["status"], _count: true }),
      prisma.task.groupBy({ by: ["status"], _count: true }),
      prisma.milestone.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);

    const volByStatus = Object.fromEntries(volunteers.map((v) => [v.status, v._count]));
    const taskByStatus = Object.fromEntries(tasks.map((t) => [t.status, t._count]));

    return {
      connected: true as const,
      raisedCents: contribs._sum.amountCents ?? 0,
      donorCount,
      volunteerTotal: volunteers.reduce((s, v) => s + v._count, 0),
      volActive: volByStatus["ACTIVE"] ?? 0,
      tasksTodo: taskByStatus["TODO"] ?? 0,
      tasksDoing: taskByStatus["DOING"] ?? 0,
      tasksDone: taskByStatus["DONE"] ?? 0,
      milestones,
    };
  } catch {
    return { connected: false as const };
  }
}

export async function getDonors(): Promise<{ connected: boolean; rows: DonorRow[] }> {
  if (!dbConfigured) return { connected: false, rows: [] };
  try {
    const donors = await prisma.donor.findMany({
      orderBy: { createdAt: "desc" },
      include: { contributions: true },
    });
    const rows = donors.map((d) => ({
      id: d.id,
      name: d.name,
      city: d.city,
      employer: d.employer,
      occupation: d.occupation,
      totalCents: d.contributions.reduce((s, c) => s + c.amountCents, 0),
    }));
    return { connected: true, rows };
  } catch {
    return { connected: false, rows: [] };
  }
}

export async function getVolunteers() {
  if (!dbConfigured) return { connected: false, rows: [] as Awaited<ReturnType<typeof prisma.volunteer.findMany>> };
  try {
    const rows = await prisma.volunteer.findMany({ orderBy: { createdAt: "desc" } });
    return { connected: true, rows };
  } catch {
    return { connected: false, rows: [] };
  }
}

export async function getTasks() {
  if (!dbConfigured) return { connected: false, rows: [] as Awaited<ReturnType<typeof prisma.task.findMany>> };
  try {
    const rows = await prisma.task.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "asc" }] });
    return { connected: true, rows };
  } catch {
    return { connected: false, rows: [] };
  }
}
