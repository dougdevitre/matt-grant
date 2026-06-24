// Server-side Resource loaders for the research dashboard. These move the pages'
// inline `Promise.all([...DynamoDB readers]) + try/catch` into one place so the
// degraded/empty/provenance treatment is consistent with the rest of the app.
// Retrieval only — the ingest/write path is untouched.
import { dbConfigured } from "@/lib/db";
import { loadField, getCandidate } from "@/lib/integrations/research/candidates";
import { loadStatements, statementsFor } from "@/lib/integrations/statements/data";
import { analyzeField, alignCandidate } from "@/lib/analysis/alignment";
import { fieldFreshness, type Freshness } from "@/lib/integrations/research/freshness";
import { lastFieldIngest } from "@/lib/integrations/research/ingestField";
import {
  getAllFec,
  getAllFecDetail,
  getAllNews,
  getFec,
  getDonorProfile,
  getFecDetail,
  getWikiBio,
  getNews,
  getStateLeg,
} from "@/lib/integrations/research/store";
import { getVotes, getBills } from "@/lib/integrations/legislative/store";
import { type Provenance, type Resource, ok, degraded } from "./resource";

export type FieldBundle = {
  field: ReturnType<typeof loadField>;
  analysis: ReturnType<typeof analyzeField>;
  fec: Awaited<ReturnType<typeof getAllFec>>;
  detail: Awaited<ReturnType<typeof getAllFecDetail>>;
  news: Awaited<ReturnType<typeof getAllNews>>;
  run: Awaited<ReturnType<typeof lastFieldIngest>>;
  fresh: Freshness;
};

/**
 * The MO-02 field overview. Roster + alignment (config compute) is always present;
 * the DynamoDB-backed money/news/freshness degrade gracefully so the matrix always
 * renders. `meta.degraded.reason` distinguishes store-not-connected vs not-ingested
 * vs stale vs read-failed.
 */
export async function loadFieldResearch(now: string): Promise<Resource<FieldBundle>> {
  const field = loadField().filter((c) => c.active !== false);
  const statements = loadStatements();
  const analysis = analyzeField(field, statements, now);
  const base: Provenance = { source: "Research field (DynamoDB)", kind: "api", live: true, count: field.length };

  let fec: FieldBundle["fec"] = {};
  let detail: FieldBundle["detail"] = {};
  let news: FieldBundle["news"] = {};
  let run: FieldBundle["run"] = null;
  let readFailed = false;
  if (dbConfigured) {
    try {
      [fec, detail, news, run] = await Promise.all([getAllFec(), getAllFecDetail(), getAllNews(), lastFieldIngest()]);
    } catch {
      readFailed = true;
    }
  }
  const fresh = fieldFreshness({ detail, news, fec, runAt: run?.startedAt ?? null });
  const bundle: FieldBundle = { field, analysis, fec, detail, news, run, fresh };

  if (!dbConfigured) return degraded(bundle, "research store not connected — roster + alignment only", base);
  if (readFailed) return degraded(bundle, "research store read failed — roster + alignment only", base);
  if (fresh.latestAt == null) return degraded(bundle, "no candidate data ingested yet — run /api/research/ingest", base);
  if (fresh.stale) {
    return degraded(bundle, `data is stale (as of ${new Date(fresh.latestAt).toLocaleDateString()})`, {
      ...base,
      fetchedAt: fresh.latestAt,
    });
  }
  return ok(bundle, { ...base, fetchedAt: fresh.latestAt });
}

export type CandidateBundle = {
  candidate: NonNullable<ReturnType<typeof getCandidate>>;
  statements: ReturnType<typeof statementsFor>;
  alignment: ReturnType<typeof alignCandidate>;
  fec: Awaited<ReturnType<typeof getFec>>;
  donors: Awaited<ReturnType<typeof getDonorProfile>>;
  detail: Awaited<ReturnType<typeof getFecDetail>>;
  bio: Awaited<ReturnType<typeof getWikiBio>>;
  news: Awaited<ReturnType<typeof getNews>>;
  stateLeg: Awaited<ReturnType<typeof getStateLeg>>;
  votes: Awaited<ReturnType<typeof getVotes>>;
  bills: Awaited<ReturnType<typeof getBills>>;
};

/**
 * One candidate's research. `null` when the slug is unknown (caller → notFound()).
 * Alignment + statements (config) are always present; the DynamoDB reads degrade.
 */
export async function loadCandidateResearch(slug: string): Promise<Resource<CandidateBundle> | null> {
  const candidate = getCandidate(slug);
  if (!candidate) return null;
  const statements = statementsFor(slug);
  const alignment = alignCandidate(candidate, statements);
  const base: Provenance = { source: `${candidate.name} research (DynamoDB)`, kind: "api", live: true };

  let fec: CandidateBundle["fec"] = null;
  let donors: CandidateBundle["donors"] = null;
  let detail: CandidateBundle["detail"] = null;
  let bio: CandidateBundle["bio"] = null;
  let news: CandidateBundle["news"] = null;
  let stateLeg: CandidateBundle["stateLeg"] = null;
  let votes: CandidateBundle["votes"] = [];
  let bills: CandidateBundle["bills"] = [];
  let readFailed = false;
  if (dbConfigured) {
    try {
      [fec, donors, detail, bio, news, stateLeg, votes, bills] = await Promise.all([
        getFec(slug),
        getDonorProfile(slug),
        getFecDetail(slug),
        getWikiBio(slug),
        getNews(slug),
        candidate.stateLegId ? getStateLeg(slug) : Promise.resolve(null),
        candidate.bioguideId ? getVotes(candidate.bioguideId) : Promise.resolve([]),
        candidate.bioguideId ? getBills(candidate.bioguideId, { relation: "sponsored" }) : Promise.resolve([]),
      ]);
    } catch {
      readFailed = true;
    }
  }
  const bundle: CandidateBundle = { candidate, statements, alignment, fec, donors, detail, bio, news, stateLeg, votes, bills };

  if (!dbConfigured) return degraded(bundle, "research store not connected — alignment + statements only", base);
  if (readFailed) return degraded(bundle, "research store read failed", base);
  const anyStored = !!(fec || donors || detail || bio || (news && news.items.length) || stateLeg || votes.length || bills.length);
  if (!anyStored) return degraded(bundle, "no stored record yet — run /api/research/ingest", base);
  return ok(bundle, base);
}
