// House Clerk roll-call votes. Each roll is an XML doc at
// https://clerk.house.gov/evs/{year}/roll{NNN}.xml — the <legislator> elements
// carry @name-id = bioguide ID, so we can extract a member's position directly.
import { XMLParser } from "fast-xml-parser";
import type { LegVoteRec } from "./types";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" });

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// Fetch one roll-call and extract this member's position, or null if the roll
// doesn't exist (404 gaps are normal) or the member isn't recorded on it.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET the roll XML, retrying transient failures (network error / 5xx). A genuine
// 404 means the roll doesn't exist and returns immediately. Without the retry, a
// blip on one of hundreds of concurrent fetches silently undercounts the record.
async function fetchRollXml(url: string, retries = 2): Promise<Response | null> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    } catch {
      if (attempt < retries) { await sleep(400 * (attempt + 1)); continue; }
      return null; // network failure after retries — best-effort gap
    }
    if (res.status === 404) return res; // genuine gap, don't retry
    if (!res.ok && attempt < retries) { await sleep(400 * (attempt + 1)); continue; }
    return res;
  }
}

async function fetchRoll(bioguideId: string, year: number, roll: number): Promise<LegVoteRec | null> {
  const rs = String(roll).padStart(3, "0");
  const url = `https://clerk.house.gov/evs/${year}/roll${rs}.xml`;
  const res = await fetchRollXml(url);
  if (!res || !res.ok) return null; // roll doesn't exist or transient failure exhausted retries
  const xml = await res.text();
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return null;
  }
  const rc = doc["rollcall-vote"] as Record<string, unknown> | undefined;
  if (!rc) return null;
  const meta = (rc["vote-metadata"] as Record<string, unknown>) ?? {};
  const data = (rc["vote-data"] as Record<string, unknown>) ?? {};
  const recs = asArray(data["recorded-vote"] as Record<string, unknown> | Record<string, unknown>[]);
  const mine = recs.find((r) => (r.legislator as Record<string, unknown>)?.["@name-id"] === bioguideId);
  if (!mine) return null;
  const voteVal = mine.vote;
  const position = typeof voteVal === "string" ? voteVal : (voteVal as Record<string, unknown>)?.["#text"]?.toString() ?? null;
  return {
    year,
    rollNumber: roll,
    position,
    question: (meta["vote-question"] as string) ?? null,
    result: (meta["vote-result"] as string) ?? null,
    legisNum: (meta["legis-num"] as string) ?? null,
    voteDate: (meta["action-date"] as string) ?? null,
    sourceUrl: url,
  };
}

export async function fetchMemberVotes(
  bioguideId: string,
  year: number,
  fromRoll: number,
  toRoll: number,
): Promise<LegVoteRec[]> {
  // The rolls are independent HTTP GETs; fetching them sequentially is the main
  // cost of an ingest and blows the SSR gateway timeout. Run them in bounded
  // batches (Clerk is a static-file host, so modest concurrency is safe) and
  // keep the results ordered by roll number.
  const rolls: number[] = [];
  for (let r = fromRoll; r <= toRoll; r++) rolls.push(r);

  const BATCH = 12;
  const votes: LegVoteRec[] = [];
  for (let i = 0; i < rolls.length; i += BATCH) {
    const batch = rolls.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((roll) => fetchRoll(bioguideId, year, roll)));
    for (const r of results) if (r) votes.push(r);
  }
  votes.sort((a, b) => a.rollNumber - b.rollNumber);
  return votes;
}
