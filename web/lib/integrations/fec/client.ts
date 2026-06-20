// Minimal OpenFEC client (api.open.fec.gov/v1). Public campaign-finance data.
// Free key at https://api.data.gov/signup/ — DEMO_KEY works at low rate limits.
import type { FecSummary, DonorProfile, DonorBucket, CycleFinance, FecDetail, IeSpender, SpendCategory } from "./types";
import { fetchJsonWithRetry } from "../http";

const BASE = "https://api.open.fec.gov/v1";

type Json = Record<string, unknown>;

export const fecEnabled = !!process.env.FEC_API_KEY;

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export class FecClient {
  private key: string;
  constructor(apiKey?: string) {
    this.key = apiKey ?? process.env.FEC_API_KEY ?? "DEMO_KEY";
  }

  private async get(path: string, params: Record<string, string> = {}): Promise<Json> {
    const u = new URL(BASE + path);
    u.searchParams.set("api_key", this.key);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return await fetchJsonWithRetry<Json>(u, { headers: { accept: "application/json" }, label: `openfec ${path}` });
  }

  // Candidate identity + the most recent two-year cycle totals.
  async getSummary(fecCandidateId: string, cycle: number): Promise<FecSummary> {
    const [candResp, totResp, committee] = await Promise.all([
      this.get(`/candidate/${fecCandidateId}/`),
      this.get(`/candidate/${fecCandidateId}/totals/`, { cycle: String(cycle), per_page: "1", sort: "-cycle" }),
      this.principalCommittee(fecCandidateId),
    ]);
    const cand = ((candResp.results as Json[] | undefined)?.[0] ?? {}) as Json;
    const t = ((totResp.results as Json[] | undefined)?.[0] ?? {}) as Json;

    return {
      fecCandidateId,
      name: (cand.name as string) ?? null,
      party: (cand.party_full as string) ?? (cand.party as string) ?? null,
      office: (cand.office_full as string) ?? (cand.office as string) ?? null,
      cycle,
      totals: {
        receipts: num(t.receipts),
        disbursements: num(t.disbursements),
        cashOnHand: num(t.last_cash_on_hand_end_period ?? t.cash_on_hand_end_period),
        individualContributions: num(t.individual_contributions ?? t.individual_itemized_contributions),
        pacContributions: num(t.other_political_committee_contributions),
      },
      principalCommittee: committee?.name ?? null,
      sourceUrl: `https://www.fec.gov/data/candidate/${fecCandidateId}/`,
      retrievedAt: new Date().toISOString(),
    };
  }

  // The /candidate/{id}/ endpoint omits principal_committees; the committee
  // list lives at /candidate/{id}/committees/ (designation "P" = principal).
  private async principalCommittee(fecCandidateId: string): Promise<{ id: string; name: string | null } | null> {
    const d = await this.get(`/candidate/${fecCandidateId}/committees/`, { per_page: "30" });
    const rows = (d.results as Json[] | undefined) ?? [];
    const principal = rows.find((c) => c.designation === "P") ?? rows[0];
    if (!principal?.committee_id) return null;
    return { id: String(principal.committee_id), name: (principal.name as string) ?? null };
  }

  private async committeeId(fecCandidateId: string): Promise<string | null> {
    return (await this.principalCommittee(fecCandidateId))?.id ?? null;
  }

  // Per-cycle fundraising arc + independent expenditures for/against — the
  // money spine of the tenure timeline. One totals call + one IE call per cycle.
  async getCycleFinance(fecCandidateId: string): Promise<CycleFinance[]> {
    const totResp = await this.get(`/candidate/${fecCandidateId}/totals/`, { per_page: "30", sort: "cycle" });
    // Dedupe by cycle (the API can echo rows with a null cycle field).
    const byCycle = new Map<number, Json>();
    for (const r of (totResp.results as Json[] | undefined) ?? []) {
      const c = num(r.cycle);
      if (c && !byCycle.has(c)) byCycle.set(c, r);
    }
    const cycles = [...byCycle.keys()].sort((a, b) => a - b);

    const ie = await Promise.all(
      cycles.map(async (cycle) => {
        try {
          const d = await this.get("/schedules/schedule_e/by_candidate/", {
            candidate_id: fecCandidateId,
            cycle: String(cycle),
            election_full: "true",
          });
          let support = 0,
            oppose = 0;
          for (const r of (d.results as Json[] | undefined) ?? []) {
            const t = num(r.total) ?? 0;
            if (r.support_oppose_indicator === "S") support += t;
            else if (r.support_oppose_indicator === "O") oppose += t;
          }
          return { cycle, support, oppose };
        } catch {
          return { cycle, support: null as number | null, oppose: null as number | null };
        }
      }),
    );
    const ieByCycle = new Map(ie.map((x) => [x.cycle, x]));

    return cycles.map((cycle) => {
      const t = byCycle.get(cycle)!;
      const e = ieByCycle.get(cycle);
      return {
        cycle,
        receipts: num(t.receipts),
        disbursements: num(t.disbursements),
        cashOnHand: num(t.last_cash_on_hand_end_period ?? t.cash_on_hand_end_period),
        ieSupport: e?.support ?? null,
        ieOppose: e?.oppose ?? null,
        sourceUrl: `https://www.fec.gov/data/candidate/${fecCandidateId}/?cycle=${cycle}`,
      };
    });
  }

  private async aggregate(
    path: string,
    committeeId: string,
    cycle: number,
    labelKey: string,
  ): Promise<DonorBucket[]> {
    const d = await this.get(path, { committee_id: committeeId, cycle: String(cycle), per_page: "10", sort: "-total" });
    const rows = (d.results as Json[] | undefined) ?? [];
    return rows
      .map((r) => ({ label: String(r[labelKey] ?? "—"), amount: num(r.total) ?? 0 }))
      .filter((b) => b.amount > 0);
  }

  // Donor profile from Schedule A aggregates (OpenSecrets replacement).
  async getDonorProfile(fecCandidateId: string, cycle: number): Promise<DonorProfile> {
    const committeeId = await this.committeeId(fecCandidateId);
    const base = { fecCandidateId, committeeId, cycle, sourceUrl: `https://www.fec.gov/data/candidate/${fecCandidateId}/`, retrievedAt: new Date().toISOString() };
    if (!committeeId) {
      return { ...base, topEmployers: [], topOccupations: [], bySize: [], byState: [] };
    }
    const [topEmployers, topOccupations, bySizeRaw, byState] = await Promise.all([
      this.aggregate("/schedules/schedule_a/by_employer/", committeeId, cycle, "employer"),
      this.aggregate("/schedules/schedule_a/by_occupation/", committeeId, cycle, "occupation"),
      this.get("/schedules/schedule_a/by_size/", { committee_id: committeeId, cycle: String(cycle) }),
      this.aggregate("/schedules/schedule_a/by_state/", committeeId, cycle, "state"),
    ]);
    const SIZE_LABEL: Record<string, string> = { "0": "≤ $200", "200": "$200–499", "500": "$500–999", "1000": "$1,000–1,999", "2000": "$2,000+" };
    const bySize = ((bySizeRaw.results as Json[] | undefined) ?? [])
      .map((r) => ({ label: SIZE_LABEL[String(r.size)] ?? `$${r.size}+`, amount: num(r.total) ?? 0 }))
      .filter((b) => b.amount > 0);
    return { ...base, topEmployers, topOccupations, bySize, byState };
  }

  // Deeper profile detail: outside money (Schedule E, for/against + top spenders)
  // and how the campaign spends (Schedule B disbursements by purpose).
  async getDetail(fecCandidateId: string, cycle: number): Promise<FecDetail> {
    const committeeId = await this.committeeId(fecCandidateId);
    const [ie, spending] = await Promise.all([
      this.independentExpenditures(fecCandidateId, cycle),
      committeeId ? this.spendingByPurpose(committeeId, cycle) : Promise.resolve({ total: 0, byPurpose: [] as SpendCategory[] }),
    ]);
    return {
      fecCandidateId,
      cycle,
      ie,
      spending,
      sourceUrl: `https://www.fec.gov/data/independent-expenditures/?data_type=processed&candidate_id=${fecCandidateId}&cycle=${cycle}`,
      retrievedAt: new Date().toISOString(),
    };
  }

  // Accurate for/against totals from the by_candidate aggregate; top spenders
  // from raw Schedule E (top 100 by amount), grouped per committee + stance.
  private async independentExpenditures(candidateId: string, cycle: number): Promise<FecDetail["ie"]> {
    const [byCand, raw] = await Promise.all([
      this.get("/schedules/schedule_e/by_candidate/", { candidate_id: candidateId, cycle: String(cycle), election_full: "true" }).catch(() => ({} as Json)),
      this.get("/schedules/schedule_e/", { candidate_id: candidateId, cycle: String(cycle), election_full: "true", per_page: "100", sort: "-expenditure_amount" }).catch(() => ({} as Json)),
    ]);
    let support = 0;
    let oppose = 0;
    for (const r of (byCand.results as Json[] | undefined) ?? []) {
      const t = num(r.total) ?? 0;
      if (r.support_oppose_indicator === "S") support += t;
      else if (r.support_oppose_indicator === "O") oppose += t;
    }
    const byCommittee = new Map<string, IeSpender>();
    for (const r of (raw.results as Json[] | undefined) ?? []) {
      const amount = num(r.expenditure_amount) ?? 0;
      if (amount <= 0) continue;
      const stance: IeSpender["stance"] = r.support_oppose_indicator === "O" ? "oppose" : "support";
      const committee = String(r.committee_name ?? (r.committee as Json | undefined)?.name ?? "Unknown committee");
      const key = `${committee}|${stance}`;
      const prev = byCommittee.get(key);
      if (prev) prev.amount += amount;
      else byCommittee.set(key, { committee, amount, stance });
    }
    // If the aggregate endpoint returned nothing, fall back to the raw rows.
    if (support === 0 && oppose === 0) {
      for (const s of byCommittee.values()) {
        if (s.stance === "support") support += s.amount;
        else oppose += s.amount;
      }
    }
    const topSpenders = [...byCommittee.values()].sort((a, b) => b.amount - a.amount).slice(0, 6);
    return { support, oppose, topSpenders };
  }

  private async spendingByPurpose(committeeId: string, cycle: number): Promise<FecDetail["spending"]> {
    // Schedule B aggregate takes committee_id as a param (same shape as the
    // Schedule A donor aggregates), NOT a /committee/{id}/ nested path.
    const d = await this.get("/schedules/schedule_b/by_purpose/", { committee_id: committeeId, cycle: String(cycle), per_page: "20", sort: "-total" }).catch(() => ({} as Json));
    const byPurpose: SpendCategory[] = ((d.results as Json[] | undefined) ?? [])
      .map((r) => ({ purpose: String(r.purpose ?? "—"), amount: num(r.total) ?? 0 }))
      .filter((b) => b.amount > 0)
      .slice(0, 8);
    const total = byPurpose.reduce((s, b) => s + b.amount, 0);
    return { total, byPurpose };
  }
}
