// Minimal Congress.gov API client (api.congress.gov/v3). Public data; key via env.
import type { LegBillRec, LegMember } from "./types";
import { fetchJsonWithRetry } from "../http";

const BASE = "https://api.congress.gov/v3";

type Json = Record<string, unknown>;

// 117 → "117th", 101 → "101st", 103 → "103rd". congress.gov bill URLs use the
// ordinal congress in the path; the old `${n}th-congress` produced dead links for
// 1st/2nd/3rd/21st/… congresses.
function ordinalCongress(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

export class CongressClient {
  constructor(private apiKey: string) {}

  private async get(path: string, params: Record<string, string> = {}): Promise<Json> {
    const u = new URL(BASE + path);
    u.searchParams.set("api_key", this.apiKey);
    u.searchParams.set("format", "json");
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return await fetchJsonWithRetry<Json>(u, { headers: { accept: "application/json" }, label: `congress.gov ${path}` });
  }

  async getMember(bioguideId: string): Promise<LegMember> {
    const d = await this.get(`/member/${bioguideId}`);
    const m = (d.member ?? {}) as Json;
    const terms = (m.terms as Json[] | undefined) ?? [];
    const last = terms[terms.length - 1] as Json | undefined;
    return {
      bioguideId,
      name: String(m.directOrderName ?? m.invertedOrderName ?? m.name ?? bioguideId),
      party: (m.partyHistory as Json[] | undefined)?.slice(-1)?.[0]?.partyName as string | undefined ?? (m.partyName as string | undefined) ?? null,
      state: (m.state as string | undefined) ?? (last?.stateName as string | undefined) ?? null,
      district: m.district != null ? String(m.district) : (last?.district != null ? String(last.district) : null),
      profile: m,
    };
  }

  private async paginate(path: string, key: string): Promise<Json[]> {
    const out: Json[] = [];
    const limit = 250;
    let offset = 0;
    for (let i = 0; i < 40; i++) {
      const d = await this.get(path, { limit: String(limit), offset: String(offset) });
      const items = (d[key] as Json[] | undefined) ?? [];
      out.push(...items);
      if (items.length < limit) break;
      offset += limit;
      if (i === 39) console.warn(`congress.gov paginate: hit ${40 * limit}-record cap on ${path}; results may be truncated (M7)`);
    }
    return out;
  }

  private normBill(raw: Json, relation: "sponsored" | "cosponsored"): LegBillRec {
    // sponsored/cosponsored items sometimes nest the bill under `.legislation`.
    const b = ((raw.legislation as Json) ?? raw) as Json;
    const congress = Number(b.congress ?? 0);
    const billType = String(b.type ?? b.billType ?? "").toUpperCase();
    const number = String(b.number ?? "");
    const policyArea = (b.policyArea as Json | undefined)?.name as string | undefined;
    return {
      relation,
      congress,
      billType,
      number,
      title: (b.title as string | undefined) ?? null,
      policyArea: policyArea ?? null,
      introducedDate: (b.introducedDate as string | undefined) ?? null,
      sourceUrl: congress > 0
        ? `https://www.congress.gov/bill/${ordinalCongress(congress)}-congress/${billType.toLowerCase()}/${number}`
        : `https://www.congress.gov/search?q=${encodeURIComponent(`${billType} ${number}`)}`,
    };
  }

  // Terms served (one per Congress) — the tenure backbone for the timeline.
  async getTerms(bioguideId: string): Promise<{ congress: number; chamber: string; startYear: number; endYear: number | null }[]> {
    const d = await this.get(`/member/${bioguideId}`);
    const m = (d.member ?? {}) as Json;
    const terms = (m.terms as Json[] | undefined) ?? [];
    return terms
      .map((t) => ({
        congress: Number(t.congress ?? 0),
        chamber: String(t.chamber ?? ""),
        startYear: Number(t.startYear ?? 0),
        endYear: t.endYear != null ? Number(t.endYear) : null,
      }))
      .filter((t) => t.congress > 0)
      .sort((a, b) => a.congress - b.congress);
  }

  async getSponsored(bioguideId: string): Promise<LegBillRec[]> {
    const items = await this.paginate(`/member/${bioguideId}/sponsored-legislation`, "sponsoredLegislation");
    return items.map((i) => this.normBill(i, "sponsored")).filter((b) => b.number);
  }

  async getCosponsored(bioguideId: string): Promise<LegBillRec[]> {
    const items = await this.paginate(`/member/${bioguideId}/cosponsored-legislation`, "cosponsoredLegislation");
    return items.map((i) => this.normBill(i, "cosponsored")).filter((b) => b.number);
  }
}
