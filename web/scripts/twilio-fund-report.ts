/**
 * Twilio-fund report generator (candidate/twilio-fund-plan.md) — run with tsx:
 *
 *   DYNAMODB_TABLE=matt-grant npx tsx scripts/twilio-fund-report.ts
 *   ... [--budget 2000] [--cost-cents 2] [--out ../candidate/_twilio-fund-appendix.md]
 *
 * READ-ONLY. Joins the opted-in SMS audience (the SMSCONSENT ledger — the ONLY
 * textable numbers under TCPA) to voter scores where a contact matches a voter
 * record by name+ZIP, then prints an aggregate cohort table and a priority budget
 * allocation. It NEVER emits a phone number, name, or any recipient row — only
 * per-segment counts — and it never sends anything. Voter-file numbers are never
 * texted; this report only helps aim the consent-based SMS budget.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { TABLE, PK, queryAllPages } from "../lib/db";
import { matchPhones, type PhoneContact } from "../lib/voters/phones";
import { toE164 } from "../lib/sms/send";
import { SEGMENTS, type Segment } from "../lib/voters/score";
import type { StoredVoter } from "../lib/voters/storeTypes";
import { allocateBudget, buildCohorts, emptySeg, renderReport, type MatchedPair } from "../lib/reports/twilioFund";

const args = process.argv.slice(2);
const opt = (name: string, dflt: string): string => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

async function main() {
  if (!TABLE) {
    console.error("Set DYNAMODB_TABLE (read-only report).");
    process.exit(1);
  }
  const budgetCents = Math.round(Number(opt("--budget", "2000")) * 100);
  const costPerSmsCents = Math.round(Number(opt("--cost-cents", "2")));
  const outArg = opt("--out", "");

  // 1) Opted-in / opted-out from the consent ledger (the textable audience).
  const consent = await queryAllPages({
    TableName: TABLE,
    KeyConditionExpression: "PK = :p",
    ExpressionAttributeValues: { ":p": "SMSCONSENT" },
  });
  const optedIn = new Set<string>();
  let optedOut = 0;
  for (const c of consent) {
    const e = toE164(String(c.SK));
    if (!e) continue;
    if (c.status === "opted_in") optedIn.add(e);
    else if (c.status === "opted_out") optedOut++;
  }

  // 2) Named campaign contacts with a phone (volunteers + donors) — the only rows
  //    that carry both an identity (name+ZIP) and a number, so the only way to
  //    attach a voter score to an opted-in number.
  const [vols, donors] = await Promise.all([
    queryAllPages({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.volunteers } }),
    queryAllPages({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.donors } }),
  ]);
  const contacts: PhoneContact[] = [...vols, ...donors]
    .map((r) => ({ name: String(r.name ?? ""), zip: r.zip ? String(r.zip) : null, phone: r.phone ? String(r.phone) : null }))
    .filter((c) => c.name && c.phone);

  // 3) The scored voter universe (growth ceiling) + the precinct list, from the
  //    aggregates only (never scans the 577k voter partition space at once).
  const aggs = await queryAllPages({
    TableName: TABLE,
    KeyConditionExpression: "PK = :p",
    ExpressionAttributeValues: { ":p": PK.voterAgg },
  });
  const universe = emptySeg();
  const precinctKeys: string[] = [];
  for (const a of aggs) {
    if (typeof a.SK === "string") precinctKeys.push(a.SK);
    const seg = (a.seg && typeof a.seg === "object" ? a.seg : {}) as Record<string, number>;
    for (const s of SEGMENTS) universe[s] += Number(seg[s] ?? 0);
  }

  // 4) Per precinct: match this shard's voters to the named contacts, and record
  //    (segment, E.164 phone) for each match — one shard in memory at a time.
  const matched: MatchedPair[] = [];
  for (const pk of precinctKeys) {
    const rows = await queryAllPages({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": PK.voterShard(pk) },
    });
    const voters = rows
      .map((r) => ({
        voterId: String(r.SK ?? ""),
        firstName: String(r.firstName ?? ""),
        lastName: String(r.lastName ?? ""),
        zip: String(r.zip ?? ""),
        segment: (typeof r.segment === "string" ? r.segment : "MONITOR") as Segment,
      }))
      .filter((v) => v.voterId);
    const byVoter = new Map(voters.map((v) => [v.voterId, v.segment]));
    const idToPhone = matchPhones(voters as unknown as StoredVoter[], contacts);
    for (const [voterId, phone] of Object.entries(idToPhone)) {
      const e = toE164(phone);
      const seg = byVoter.get(voterId);
      if (e && seg) matched.push({ segment: seg, phone: e });
    }
  }

  const cohorts = buildCohorts({ optedIn, optedOut, matched, universe });
  const plan = allocateBudget(cohorts, { budgetCents, costPerSmsCents });
  // Use the newest ingest manifest date as the "as of" stamp — no Date.now noise.
  const runs = await queryAllPages({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.ingestRuns("voters") } });
  const generatedAt = runs.length ? String(runs.sort((a, b) => String(b.SK).localeCompare(String(a.SK)))[0].SK).slice(0, 10) : "(no ingest run)";

  const md = renderReport(cohorts, plan, { costPerSmsCents, generatedAt, source: `table ${TABLE}` });
  if (outArg) {
    const path = join(process.cwd(), outArg);
    writeFileSync(path, md + "\n");
    console.log(`Wrote ${path}`);
  } else {
    console.log("\n" + md + "\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
