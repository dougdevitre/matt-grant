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

export async function fetchMemberVotes(
  bioguideId: string,
  year: number,
  fromRoll: number,
  toRoll: number,
): Promise<LegVoteRec[]> {
  const votes: LegVoteRec[] = [];
  for (let roll = fromRoll; roll <= toRoll; roll++) {
    const rs = String(roll).padStart(3, "0");
    const url = `https://clerk.house.gov/evs/${year}/roll${rs}.xml`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      continue;
    }
    if (!res.ok) continue; // 404 = roll doesn't exist (gaps are normal)
    const xml = await res.text();
    let doc: Record<string, unknown>;
    try {
      doc = parser.parse(xml) as Record<string, unknown>;
    } catch {
      continue;
    }
    const rc = doc["rollcall-vote"] as Record<string, unknown> | undefined;
    if (!rc) continue;
    const meta = (rc["vote-metadata"] as Record<string, unknown>) ?? {};
    const data = (rc["vote-data"] as Record<string, unknown>) ?? {};
    const recs = asArray(data["recorded-vote"] as Record<string, unknown> | Record<string, unknown>[]);
    const mine = recs.find((r) => (r.legislator as Record<string, unknown>)?.["@name-id"] === bioguideId);
    if (!mine) continue;
    const voteVal = mine.vote;
    const position = typeof voteVal === "string" ? voteVal : (voteVal as Record<string, unknown>)?.["#text"]?.toString() ?? null;
    votes.push({
      year,
      rollNumber: roll,
      position,
      question: (meta["vote-question"] as string) ?? null,
      result: (meta["vote-result"] as string) ?? null,
      legisNum: (meta["legis-num"] as string) ?? null,
      voteDate: (meta["action-date"] as string) ?? null,
      sourceUrl: url,
    });
  }
  return votes;
}
