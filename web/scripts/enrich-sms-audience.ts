/**
 * SMS audience enrichment job (candidate/sms-targeting-plan.md §2 Phase 1 +
 * candidate/sms-conversational-interface-plan.md §5) — run with tsx:
 *
 *   DYNAMODB_TABLE=matt-grant npx tsx scripts/enrich-sms-audience.ts [--dry-run]
 *
 * The out-of-band bridge across the TCPA wall: tags each OPTED-IN consent row with
 * denormalized voter fields — voterSegment, voterT, banked, county, zip — so the
 * broadcast composer can target by them while lib/sms/ still never reads a voter
 * partition. Targeting only ever NARROWS the opted-in audience; opt-in remains the
 * only gate.
 *
 * The orchestration lives in lib/reports/smsEnrichmentRun.ts so the nightly cron
 * (app/api/cron/sms-enrich) runs the SAME code path; this file is the CLI wrapper —
 * it prints the counts-only summary (no phone number or name is ever printed).
 * Re-run nightly during the GOTV window so `banked` tracks the daily ballot returns.
 */
import { runSmsEnrichment } from "../lib/reports/smsEnrichmentRun";
import { COUNTIES } from "../lib/sms/geo";

const DRY = process.argv.includes("--dry-run");

async function main() {
  const s = await runSmsEnrichment({ dryRun: DRY });
  console.log(`Opted-in ledger: ${s.optedIn}`);
  console.log(`Voter-matched tags: ${s.voterMatchedTags}`);
  console.log(`Contact-ZIP-only tags: ${s.contactZipOnlyTags}`);
  console.log(`Self-reported geography preserved: ${s.geoPreserved}`);
  console.log(`Not opted in (never tagged): ${s.skippedNotOptedIn}`);
  for (const [k, n] of Object.entries(s.byCounty)) console.log(`  county ${COUNTIES[k as keyof typeof COUNTIES]?.name ?? k}: ${n}`);
  console.log(DRY ? `DRY RUN — would write ${s.totalWrites} tags.` : `Wrote ${s.written}/${s.totalWrites} tags.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
