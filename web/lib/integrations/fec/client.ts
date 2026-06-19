// Minimal OpenFEC client (api.open.fec.gov/v1). Public campaign-finance data.
// Free key at https://api.data.gov/signup/ — DEMO_KEY works at low rate limits.
import type { FecSummary } from "./types";

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
    const candResp = await this.get(`/candidate/${fecCandidateId}/`);
    const cand = ((candResp.results as Json[] | undefined)?.[0] ?? {}) as Json;

    const totResp = await this.get(`/candidate/${fecCandidateId}/totals/`, {
      cycle: String(cycle),
      per_page: "1",
      sort: "-cycle",
    });
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
      principalCommittee: (cand.principal_committees as Json[] | undefined)?.[0]?.name as string | undefined ?? null,
      sourceUrl: `https://www.fec.gov/data/candidate/${fecCandidateId}/`,
      retrievedAt: new Date().toISOString(),
    };
  }
}
