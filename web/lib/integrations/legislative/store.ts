import { prisma } from "@/lib/db";
import type { NormalizedDataset } from "./types";

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Idempotent persistence — upserts keyed by stable unique constraints.
export async function persist(dataset: NormalizedDataset): Promise<void> {
  const { bioguideId, member } = dataset;

  await prisma.legislator.upsert({
    where: { bioguideId },
    create: {
      bioguideId,
      name: member.name,
      party: member.party ?? null,
      state: member.state ?? null,
      district: member.district ?? null,
      profile: member.profile as object,
    },
    update: {
      name: member.name,
      party: member.party ?? null,
      state: member.state ?? null,
      district: member.district ?? null,
      profile: member.profile as object,
    },
  });

  for (const v of dataset.votes) {
    await prisma.legVote.upsert({
      where: { bioguideId_year_rollNumber: { bioguideId, year: v.year, rollNumber: v.rollNumber } },
      create: { bioguideId, ...v, voteDate: parseDate(v.voteDate) },
      update: { ...v, voteDate: parseDate(v.voteDate) },
    });
  }

  for (const b of [...dataset.sponsored, ...dataset.cosponsored]) {
    await prisma.legBill.upsert({
      where: {
        bioguideId_relation_congress_billType_number: {
          bioguideId,
          relation: b.relation,
          congress: b.congress,
          billType: b.billType,
          number: b.number,
        },
      },
      create: { bioguideId, ...b, introducedDate: parseDate(b.introducedDate) },
      update: { ...b, introducedDate: parseDate(b.introducedDate) },
    });
  }
}

// ---- Read helpers (used by the API routes and the dashboard page) ----

export async function getMember(bioguideId: string) {
  return prisma.legislator.findUnique({ where: { bioguideId } });
}

export async function getVotes(bioguideId: string, opts: { year?: number; position?: string } = {}) {
  return prisma.legVote.findMany({
    where: {
      bioguideId,
      ...(opts.year ? { year: opts.year } : {}),
      ...(opts.position ? { position: opts.position } : {}),
    },
    orderBy: [{ year: "desc" }, { rollNumber: "desc" }],
  });
}

export async function getBills(bioguideId: string, opts: { relation?: string; policyArea?: string } = {}) {
  return prisma.legBill.findMany({
    where: {
      bioguideId,
      ...(opts.relation ? { relation: opts.relation } : {}),
      ...(opts.policyArea ? { policyArea: opts.policyArea } : {}),
    },
    orderBy: [{ congress: "desc" }, { introducedDate: "desc" }],
  });
}

export async function lastIngest(target: string) {
  return prisma.ingestRun.findFirst({ where: { target }, orderBy: { startedAt: "desc" } });
}
