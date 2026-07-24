/**
 * Digital custom-audience export (candidate/voter-file-plan.md — off-SMS reach) —
 * run with tsx:
 *
 *   DYNAMODB_TABLE=matt-grant npx tsx scripts/export-digital-audience.ts \
 *     --segment MOBILIZE,BANK --out audience.csv [--exclude-banked] [--state MO] [--country US]
 *
 * Produces a SHA-256-HASHED Meta Custom Audience CSV (name + city + state + zip +
 * country) for the chosen voter segment(s) across the whole district, so the campaign
 * can run digital ads to voters it lawfully holds but CANNOT text. The output contains
 * ONLY hashed match keys — no plaintext PII, no voter IDs — so raw voter data never
 * leaves the campaign. Iterates one precinct shard at a time (bounded memory), like the
 * enrichment job.
 *
 * COMPLIANCE (RSMo 115.157): voter data is for political/election purposes only. Using
 * it for the campaign's OWN political ad targeting is a political purpose and does not
 * require the individual's consent (unlike SMS). You must be an authorized political
 * advertiser on the platform and follow its Custom Audience terms. Educational
 * information, not legal advice — consult counsel before uploading.
 */
import { writeFileSync } from "node:fs";
import { audienceCsv, AUDIENCE_HEADERS, type AudienceVoter } from "../lib/voters/digitalAudience";
import { SEGMENTS, type Segment } from "../lib/voters/score";
// Query DynamoDB directly (like enrich-sms-audience.ts) — the lib/voters/store wrappers
// are "server-only" and throw under tsx, so scripts read via lib/db instead.
import { TABLE, PK, queryAllPages } from "../lib/db";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function main() {
  return run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

async function run() {
  if (!TABLE) {
    console.error("Set DYNAMODB_TABLE.");
    process.exit(1);
  }
  const out = opt("--out") ?? "digital-audience.csv";
  const excludeBanked = flag("--exclude-banked");
  const state = opt("--state") ?? "MO";
  const country = opt("--country") ?? "US";

  // Requested segments (default: everything Meta-worth targeting — all but MONITOR).
  const requested = (opt("--segment") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const bad = requested.filter((s) => !(SEGMENTS as readonly string[]).includes(s));
  if (bad.length) {
    console.error(`Unknown segment(s): ${bad.join(", ")}. Valid: ${SEGMENTS.join(", ")}.`);
    process.exit(1);
  }
  const wanted = new Set<Segment>(
    (requested.length ? (requested as Segment[]) : SEGMENTS.filter((s) => s !== "MONITOR")),
  );

  // Precinct keys from the aggregate rollups (~178 rows), then one shard at a time.
  const aggs = await queryAllPages({
    TableName: TABLE,
    KeyConditionExpression: "PK = :p",
    ExpressionAttributeValues: { ":p": PK.voterAgg },
  });
  const precinctKeys = aggs.map((a) => String(a.SK ?? "")).filter(Boolean);

  const lines: string[] = [AUDIENCE_HEADERS.join(",")];
  let total = 0;
  let bankedSkipped = 0;
  const bySegment: Record<string, number> = {};
  for (const pk of precinctKeys) {
    const shard = await queryAllPages({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": PK.voterShard(pk) },
    });
    const banked = excludeBanked
      ? new Set(
          (
            await queryAllPages({
              TableName: TABLE,
              KeyConditionExpression: "PK = :p",
              ExpressionAttributeValues: { ":p": PK.ballotReturns(pk) },
            })
          ).map((r) => String(r.SK ?? "")),
        )
      : null;

    const eligible: AudienceVoter[] = [];
    for (const r of shard) {
      const voterId = String(r.SK ?? "");
      const segment = String(r.segment ?? "MONITOR");
      if (!voterId || !wanted.has(segment as Segment)) continue;
      if (banked && banked.has(voterId)) {
        bankedSkipped++;
        continue;
      }
      eligible.push({
        firstName: String(r.firstName ?? ""),
        lastName: String(r.lastName ?? ""),
        city: String(r.city ?? ""),
        zip: String(r.zip ?? ""),
      });
      bySegment[segment] = (bySegment[segment] ?? 0) + 1;
    }
    if (eligible.length === 0) continue;
    // audienceCsv includes a header; take only its data rows (drop line 0) when appending.
    for (const row of audienceCsv(eligible, { state, country }).trim().split("\n").slice(1)) lines.push(row);
    total += eligible.length;
  }

  writeFileSync(out, lines.join("\n") + "\n");

  // Counts only — never a name, address, or hash sample.
  console.log(`Wrote ${total} hashed rows → ${out}`);
  for (const s of SEGMENTS) if (bySegment[s]) console.log(`  ${s}: ${bySegment[s]}`);
  if (excludeBanked) console.log(`Excluded (already voted): ${bankedSkipped}`);
  console.log("");
  console.log("RSMo 115.157: political/election use only. Upload to Meta Ads Manager →");
  console.log("Audiences → Create → Custom Audience → Customer list (mark data as already hashed).");
  console.log("You must be an authorized political advertiser and follow the platform's terms.");
  console.log("Educational information, not legal advice — consult counsel before uploading.");
}

main();
