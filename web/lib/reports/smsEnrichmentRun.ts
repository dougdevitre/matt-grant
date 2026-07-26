// SMS audience enrichment — the ORCHESTRATION (DynamoDB reads + writes) behind
// the enrich job, extracted so BOTH the CLI (scripts/enrich-sms-audience.ts) and
// the nightly cron route (app/api/cron/sms-enrich) call the same code path.
//
// The out-of-band bridge across the TCPA wall: this module (allowed to read both
// sides) tags each OPTED-IN consent row with denormalized voter fields —
// voterSegment, voterT, banked, county, zip — so the broadcast composer can target
// by them while lib/sms/ still never reads a voter partition. It lives in
// lib/reports/ (like smsTargeting.ts / smsEnrichment.ts) because it references
// voter types; nothing under lib/sms/ imports it, so the send path never touches a
// voter partition (the isolation guard, lib/sms/audiences.voterfile-isolation.test.ts).
//
// Matching is the conservative name+ZIP join from lib/voters/phones.ts: only
// volunteers/donors who gave the campaign their number can match a voter record;
// ambiguous matches are dropped. Self-reported geography from the SMS vote agent
// (geoSource "self") is never overwritten. The returned summary is COUNTS ONLY —
// no phone number or name ever leaves this function.
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, queryAllPages } from "@/lib/db";
import { matchPhones, type PhoneContact } from "@/lib/voters/phones";
import { toE164 } from "@/lib/sms/send";
import type { Segment } from "@/lib/voters/score";
import type { StoredVoter } from "@/lib/voters/storeTypes";
import { ZIP_TO_COUNTY, matchCountyName } from "@/lib/sms/geo";
import { districtForZipUnambiguous } from "@/lib/sms/school-districts";
import { buildEnrichmentPlan, type EnrichmentWrite, type MatchedVoterTag } from "@/lib/reports/smsEnrichment";
import { overlayByPrecinct } from "@/lib/voters/overlayStore";

export type EnrichmentSummary = {
  optedIn: number; // size of the opted-in ledger
  voterMatchedTags: number; // rows getting a voterSegment (name+ZIP → voter score)
  ppTags: number; // rows getting a primary-propensity tag (0 until an overlay is ingested)
  partyTags: number; // rows getting an INFERRED party tag (0 until an overlay is ingested)
  contactZipOnlyTags: number; // rows getting geography only (no voter match)
  geoPreserved: number; // rows whose self-reported geography was kept
  skippedNotOptedIn: number; // voter-matched numbers that aren't opted in (never tagged)
  totalWrites: number; // writes the plan produced
  written: number; // writes actually applied (0 on a dry run)
  byCounty: Record<string, number>; // CountyKey → tagged count (planning only)
  dryRun: boolean;
};

/** Run the enrichment end-to-end. Pass `{ dryRun: true }` to compute the plan and
 *  the summary without writing. Throws if DYNAMODB_TABLE is unset. */
export async function runSmsEnrichment(opts: { dryRun?: boolean } = {}): Promise<EnrichmentSummary> {
  const dryRun = !!opts.dryRun;
  if (!TABLE) throw new Error("DYNAMODB_TABLE not set");

  // 1) Consent ledger: the opted-in set + each row's current geoSource (self-reported wins).
  const consent = await queryAllPages({
    TableName: TABLE,
    KeyConditionExpression: "PK = :p",
    ExpressionAttributeValues: { ":p": "SMSCONSENT" },
  });
  const optedIn = new Set<string>();
  const existingGeoSource = new Map<string, string>();
  const existingZips = new Map<string, string>();
  for (const c of consent) {
    const e = toE164(String(c.SK));
    if (!e) continue;
    if (c.status === "opted_in") optedIn.add(e);
    if (typeof c.geoSource === "string") existingGeoSource.set(e, c.geoSource);
    if (typeof c.zip === "string" && /^\d{5}$/.test(c.zip)) existingZips.set(e, c.zip);
  }

  // 2) Named campaign contacts with a phone (volunteers + donors) — identity (name+ZIP)
  //    plus a number, so they can both match a voter record and contribute a ZIP.
  const [vols, donors] = await Promise.all([
    queryAllPages({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.volunteers } }),
    queryAllPages({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.donors } }),
  ]);
  const named: PhoneContact[] = [...vols, ...donors]
    .map((r) => ({ name: String(r.name ?? ""), zip: r.zip ? String(r.zip) : null, phone: r.phone ? String(r.phone) : null }))
    .filter((c) => c.name && c.phone);
  const contactTags = named
    .map((c) => ({ phone: toE164(c.phone!) ?? "", zip: c.zip }))
    .filter((c) => c.phone);

  // 3) Per precinct (one shard in memory at a time): match voters to the named
  //    contacts and read that precinct's banked set from the ballot returns.
  const aggs = await queryAllPages({
    TableName: TABLE,
    KeyConditionExpression: "PK = :p",
    ExpressionAttributeValues: { ":p": PK.voterAgg },
  });
  const precinctKeys = aggs.map((a) => String(a.SK ?? "")).filter(Boolean);
  const matched: MatchedVoterTag[] = [];
  for (const pk of precinctKeys) {
    // The vendor overlay is queried alongside the spine — same shard key, one
    // extra query per precinct. It is empty until an overlay source is ingested,
    // in which case no pp/party tags are written (never a fabricated default).
    const [rows, returns, overlay] = await Promise.all([
      queryAllPages({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.voterShard(pk) } }),
      queryAllPages({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.ballotReturns(pk) } }),
      overlayByPrecinct(pk),
    ]);
    const banked = new Set(returns.map((r) => String(r.SK ?? "")));
    const voters = rows
      .map((r) => ({
        voterId: String(r.SK ?? ""),
        firstName: String(r.firstName ?? ""),
        lastName: String(r.lastName ?? ""),
        zip: String(r.zip ?? ""),
        county: String(r.county ?? ""),
        t: typeof r.t === "number" ? r.t : 0,
        segment: (typeof r.segment === "string" ? r.segment : "MONITOR") as Segment,
      }))
      .filter((v) => v.voterId);
    const idToPhone = matchPhones(voters as unknown as StoredVoter[], named);
    const byId = new Map(voters.map((v) => [v.voterId, v]));
    for (const [voterId, phone] of Object.entries(idToPhone)) {
      const e = toE164(phone);
      const v = byId.get(voterId);
      if (!e || !v) continue;
      const ovl = overlay.get(voterId);
      matched.push({
        phone: e,
        segment: v.segment,
        t: v.t,
        county: v.county,
        zip: v.zip,
        banked: banked.has(voterId),
        ...(ovl?.pp !== undefined ? { pp: ovl.pp } : {}),
        ...(ovl?.party ? { party: ovl.party } : {}),
      });
    }
  }

  // 4) Pure merge → the write plan.
  const plan = buildEnrichmentPlan({
    optedIn,
    matched,
    contacts: contactTags,
    existingGeoSource,
    existingZips,
    countyKeyForName: (raw) => matchCountyName(raw)?.key ?? null,
    countyKeyForZip: (z) => ZIP_TO_COUNTY[z] ?? null,
    // Crosswalk data ships empty until generated (school-districts.data.ts) —
    // this returns null for every ZIP until then, and no district is written.
    districtForZip: (z) => districtForZipUnambiguous(z),
  });

  // 5) Write the tags onto EXISTING consent rows (never creates one — a tag is
  //    metadata on consent, not consent).
  let written = 0;
  if (!dryRun) {
    for (const w of plan.writes) written += (await writeTag(w)) ? 1 : 0;
  }

  const byCounty: Record<string, number> = {};
  for (const w of plan.writes) if (w.county) byCounty[w.county] = (byCounty[w.county] ?? 0) + 1;

  return {
    optedIn: optedIn.size,
    voterMatchedTags: plan.writes.filter((w) => w.voterSegment).length,
    ppTags: plan.writes.filter((w) => w.voterPp !== undefined).length,
    partyTags: plan.writes.filter((w) => w.voterParty !== undefined).length,
    contactZipOnlyTags: plan.writes.filter((w) => !w.voterSegment).length,
    geoPreserved: plan.geoPreserved,
    skippedNotOptedIn: plan.skippedNotOptedIn,
    totalWrites: plan.writes.length,
    written,
    byCounty,
    dryRun,
  };
}

async function writeTag(w: EnrichmentWrite): Promise<boolean> {
  const sets = ["enrichedAt = :u"];
  const values: Record<string, unknown> = { ":u": new Date().toISOString() };
  if (w.voterSegment !== undefined) (sets.push("voterSegment = :vs"), (values[":vs"] = w.voterSegment));
  if (w.voterT !== undefined) (sets.push("voterT = :vt"), (values[":vt"] = w.voterT));
  if (w.voterPp !== undefined) (sets.push("voterPp = :vp"), (values[":vp"] = w.voterPp));
  if (w.voterParty !== undefined) (sets.push("voterParty = :vy"), (values[":vy"] = w.voterParty));
  if (w.banked !== undefined) (sets.push("banked = :b"), (values[":b"] = w.banked));
  if (w.county !== undefined) (sets.push("county = :c"), (values[":c"] = w.county));
  if (w.zip !== undefined) (sets.push("zip = :z"), (values[":z"] = w.zip));
  if (w.schoolDistrict !== undefined) (sets.push("schoolDistrict = :sd"), (values[":sd"] = w.schoolDistrict));
  if (w.geoSource !== undefined) (sets.push("geoSource = :g"), (values[":g"] = w.geoSource));
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: "SMSCONSENT", SK: w.phone },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "attribute_exists(SK)",
        ExpressionAttributeValues: values,
      }),
    );
    return true;
  } catch {
    return false; // row vanished between read and write — skip, next run catches it
  }
}
