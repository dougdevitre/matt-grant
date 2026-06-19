// The MO-02 primary "field". Replaces the single hard-coded bioguide with a
// roster of candidates. The roster is CONFIG-DRIVEN, never fabricated: we seed
// only the one already-known real subject (the incumbent, referenced throughout
// the repo as W000812) and load the rest from RESEARCH_FIELD_JSON as the campaign
// curates it. We do not invent opponent names, parties, or IDs.

export type Party = "R" | "D" | "I" | "L" | "G" | "O";

export type Candidate = {
  slug: string; // stable key, e.g. "ann-wagner"
  name: string;
  party: Party;
  primary: "R" | "D"; // which primary ballot they appear on
  incumbent: boolean;
  office?: string; // e.g. "U.S. House MO-02"
  bioguideId?: string | null; // federal record key — sitting/former members only
  fecCandidateId?: string | null; // FEC linkage — every federal candidate has one
  stateLegId?: string | null; // MO General Assembly key, if they held state office
  website?: string | null; // provenance for curated statements
  active?: boolean; // false once a candidate exits the race
};

// The one real, already-referenced subject. bioguide carried over from the prior
// single-target config (config.ts default). Marked for verification, as before.
const INCUMBENT_SEED: Candidate = {
  slug: "incumbent-mo02",
  name: "MO-02 incumbent",
  party: "R",
  primary: "R",
  incumbent: true,
  office: "U.S. House MO-02",
  bioguideId: process.env.RESEARCH_BIOGUIDE_ID ?? "W000812",
  fecCandidateId: process.env.RESEARCH_INCUMBENT_FEC_ID ?? null,
  stateLegId: null,
  website: null,
  active: true,
};

function parseFieldJson(raw: string): Candidate[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => ({
        slug: String(c.slug ?? ""),
        name: String(c.name ?? c.slug ?? ""),
        party: (c.party as Party) ?? "O",
        primary: (c.primary as "R" | "D") ?? "R",
        incumbent: Boolean(c.incumbent),
        office: (c.office as string) ?? "U.S. House MO-02",
        bioguideId: (c.bioguideId as string) ?? null,
        fecCandidateId: (c.fecCandidateId as string) ?? null,
        stateLegId: (c.stateLegId as string) ?? null,
        website: (c.website as string) ?? null,
        active: c.active === undefined ? true : Boolean(c.active),
      }))
      .filter((c) => c.slug);
  } catch {
    return [];
  }
}

// The full field. Curated entries (RESEARCH_FIELD_JSON) win over the seed when
// they share a slug, so the campaign can flesh out the incumbent too.
export function loadField(): Candidate[] {
  const curated = process.env.RESEARCH_FIELD_JSON ? parseFieldJson(process.env.RESEARCH_FIELD_JSON) : [];
  const bySlug = new Map<string, Candidate>();
  bySlug.set(INCUMBENT_SEED.slug, INCUMBENT_SEED);
  for (const c of curated) bySlug.set(c.slug, c);
  return [...bySlug.values()];
}

export function getCandidate(slug: string): Candidate | null {
  return loadField().find((c) => c.slug === slug) ?? null;
}

export function partyLabel(p: Party): string {
  return { R: "Republican", D: "Democrat", I: "Independent", L: "Libertarian", G: "Green", O: "Other" }[p];
}
