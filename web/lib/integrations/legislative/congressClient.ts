// Minimal Congress.gov API client (api.congress.gov/v3). Public data; key via env.
import type { LegBillRec, LegMember } from "./types";

const BASE = "https://api.congress.gov/v3";

type Json = Record<string, unknown>;

export class CongressClient {
  constructor(private apiKey: string) {}

  private async get(path: string, params: Record<string, string> = {}): Promise<Json> {
    const u = new URL(BASE + path);
    u.searchParams.set("api_key", this.apiKey);
    u.searchParams.set("format", "json");
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const res = await fetch(u, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`congress.gov ${res.status} ${path}`);
    return (await res.json()) as Json;
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
      sourceUrl: `https://www.congress.gov/bill/${congress}th-congress/${billType.toLowerCase()}/${number}`,
    };
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
