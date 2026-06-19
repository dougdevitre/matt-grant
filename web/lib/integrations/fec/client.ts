// Minimal OpenFEC client (api.open.fec.gov/v1). Public campaign-finance data.
// Free key at https://api.data.gov/signup/ — DEMO_KEY works at low rate limits.
import type { FecSummary, DonorProfile, DonorBucket } from "./types";

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
    const res = await fetch(u, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`openfec ${res.status} ${path}`);
    return (await res.json()) as Json;
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
}
