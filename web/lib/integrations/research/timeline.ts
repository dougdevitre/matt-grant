// Tenure timeline aggregator. Builds a per-Congress series for one candidate
// from verifiable public APIs — Congress.gov (terms + bills) and OpenFEC
// (per-cycle fundraising + independent expenditures). Every record carries the
// source URLs used, so the UI can render a "verify ↗" link on each data point.

import { CongressClient } from "../legislative/congressClient";
import { FecClient, fecEnabled } from "../fec/client";
import { getBills } from "../legislative/store";
import { dbConfigured } from "@/lib/db";
import type { Candidate } from "./candidates";
import type { CycleFinance } from "../fec/types";

// Bill counts per Congress, split by relation. Callers can pass bills already
// in hand (ingest) to avoid any re-fetch; otherwise we read the stored bills.
type BillRelCounts = { sponsored: Map<number, number>; cosponsored: Map<number, number> };

export type TenureTerm = {
  congress: number;
  termIndex: number; // 1-based ordinal within this member's service
  startYear: number;
  endYear: number | null;
  electionCycle: number; // the cycle that elected this term (startYear - 1)
  billsSponsored: number;
  billsCosponsored: number;
  finance: CycleFinance | null;
  sources: { terms: string; bills: string | null; finance: string | null };
};

export type TenureTimeline = {
  candidateSlug: string;
  name: string;
  totalTerms: number;
  firstYear: number | null;
  generatedAt: string;
  terms: TenureTerm[];
  // Cycles with finance data that don't map to a completed term (e.g. the
  // current open cycle) — kept so the money arc is complete.
  extraCycles: CycleFinance[];
};

const congressUrl = (id: string) => `https://www.congress.gov/member/${id}`;

// opts.bills lets the ingest pass the bills it already fetched, so the timeline
// never re-paginates Congress.gov (Wagner has 1,744 cosponsored — that double
// fetch was blowing the request budget). Without it we read the stored bills.
export async function buildTimeline(
  candidate: Candidate,
  opts?: { bills?: { relation: string; congress: number }[] },
): Promise<TenureTimeline> {
  const base: TenureTimeline = {
    candidateSlug: candidate.slug,
    name: candidate.name,
    totalTerms: 0,
    firstYear: null,
    generatedAt: new Date().toISOString(),
    terms: [],
    extraCycles: [],
  };

  // FEC money arc (any federal candidate has it).
  let finance: CycleFinance[] = [];
  if (fecEnabled && candidate.fecCandidateId) {
    try {
      finance = await new FecClient().getCycleFinance(candidate.fecCandidateId);
    } catch {
      /* leave finance empty */
    }
  }
  const financeByCycle = new Map(finance.map((f) => [f.cycle, f]));

  // Congressional tenure (members only). Terms = 1 cheap call; bill COUNTS come
  // from bills already in hand (ingest) or the store — never a fresh paginate.
  if (candidate.bioguideId && process.env.CONGRESS_GOV_API_KEY) {
    const client = new CongressClient(process.env.CONGRESS_GOV_API_KEY);
    const terms = await client.getTerms(candidate.bioguideId);

    const bills =
      opts?.bills ?? (dbConfigured ? await getBills(candidate.bioguideId).catch(() => []) : []);
    const counts: BillRelCounts = { sponsored: new Map(), cosponsored: new Map() };
    for (const b of bills) {
      const m = b.relation === "cosponsored" ? counts.cosponsored : counts.sponsored;
      m.set(b.congress, (m.get(b.congress) ?? 0) + 1);
    }
    const spon = counts.sponsored;
    const cospon = counts.cosponsored;
    const billsUrl = `https://www.congress.gov/member/${candidate.bioguideId}/legislation`;

    base.terms = terms.map((t, i) => {
      const electionCycle = t.startYear - 1;
      const fin = financeByCycle.get(electionCycle) ?? null;
      return {
        congress: t.congress,
        termIndex: i + 1,
        startYear: t.startYear,
        endYear: t.endYear,
        electionCycle,
        billsSponsored: spon.get(t.congress) ?? 0,
        billsCosponsored: cospon.get(t.congress) ?? 0,
        finance: fin,
        sources: {
          terms: congressUrl(candidate.bioguideId!),
          bills: billsUrl,
          finance: fin?.sourceUrl ?? null,
        },
      };
    });
    base.totalTerms = base.terms.length;
    base.firstYear = base.terms[0]?.startYear ?? null;

    const mappedCycles = new Set(base.terms.map((t) => t.electionCycle));
    base.extraCycles = finance.filter((f) => !mappedCycles.has(f.cycle)).sort((a, b) => a.cycle - b.cycle);
  } else {
    // Non-member: no tenure, but still surface the money arc.
    base.extraCycles = finance;
  }

  return base;
}
