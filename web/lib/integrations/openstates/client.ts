// Open States API v3 client (Plural; v3 at v3.openstates.org). Missouri General
// Assembly legislators + sponsored bills — the state-legislative record for
// candidates who held MO state office. Free key (X-API-KEY header) at
// https://openstates.org/api/register/.
export const openStatesEnabled = !!process.env.OPENSTATES_API_KEY;

const BASE = "https://v3.openstates.org";

type Json = Record<string, unknown>;

export type StateLegBill = {
  identifier: string; // e.g. "HB 1234"
  title: string | null;
  session: string | null;
  classification: string | null;
  firstAction: string | null;
  sourceUrl: string;
};

export type StateLegRecord = {
  openStatesId: string;
  name: string | null;
  party: string | null;
  currentRole: string | null; // e.g. "Representative, MO House, district 99"
  sponsored: StateLegBill[];
  sourceUrl: string;
  retrievedAt: string;
};

export class OpenStatesClient {
  private key: string;
  constructor(apiKey?: string) {
    this.key = apiKey ?? process.env.OPENSTATES_API_KEY ?? "";
  }

  private async get(path: string, params: Record<string, string> = {}): Promise<Json> {
    const u = new URL(BASE + path);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const res = await fetch(u, { headers: { "X-API-KEY": this.key, accept: "application/json" } });
    if (!res.ok) throw new Error(`openstates ${res.status} ${path}`);
    return (await res.json()) as Json;
  }

  // openStatesId is the ocd-person id (e.g. "ocd-person/....").
  async getRecord(openStatesId: string): Promise<StateLegRecord> {
    const person = await this.get(`/people/${encodeURIComponent(openStatesId)}`, { include: "other_identifiers" });
    const billsResp = await this.get("/bills", {
      jurisdiction: "Missouri",
      sponsor: openStatesId,
      sort: "latest_action_desc",
      per_page: "20",
    });
    const bills = ((billsResp.results as Json[] | undefined) ?? []).map((b): StateLegBill => ({
      identifier: String(b.identifier ?? ""),
      title: (b.title as string) ?? null,
      session: (b.session as string) ?? null,
      classification: ((b.classification as string[] | undefined) ?? [])[0] ?? null,
      firstAction: (b.first_action_date as string) ?? null,
      sourceUrl: (b.openstates_url as string) ?? "https://openstates.org",
    }));
    return {
      openStatesId,
      name: (person.name as string) ?? null,
      party: (person.party as string) ?? null,
      currentRole: (person.current_role as Json | undefined)?.title
        ? `${(person.current_role as Json).title} (${(person.current_role as Json).org_classification ?? ""})`
        : null,
      sponsored: bills,
      sourceUrl: (person.openstates_url as string) ?? "https://openstates.org",
      retrievedAt: new Date().toISOString(),
    };
  }
}
