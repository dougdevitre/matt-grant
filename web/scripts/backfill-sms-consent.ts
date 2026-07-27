// One-off backfill: move ALREADY-CONSENTED numbers into the SMS consent ledger.
//
// WHY: broadcast audiences are built ONLY from the SMSCONSENT ledger
// (lib/sms/audiences.ts). Some surfaces captured a mobile number under an explicit
// opt-in but never wrote that ledger, so the consented person could never actually
// be texted. This script sweeps those affirmative opt-ins into the ledger so they
// become reachable — WITHOUT ever manufacturing consent.
//
// Sources (only rows with a recorded affirmative "SMS Opt-In"):
//   1. Airtable game leads   (GAMES_LEAD_BASE_ID / GAMES_LEAD_TABLE_ID) → source "games-lead-backfill"
//   2. Airtable Volunteers roster (AIRTABLE_BASES.volunteer)            → source "volunteer-roster-backfill"
// The original Airtable createdTime is preserved as the consent date.
//
// Safe by construction:
//   • DRY RUN by default — reports what WOULD be written, writes NOTHING. Pass --apply to write.
//   • NEVER manufactures consent — a row is swept only when its "SMS Opt-In" is literally true
//     AND its phone normalizes to E.164. Everything else is skipped and logged.
//   • IDEMPOTENT — recordConsent is an upsert with if_not_exists on consentAt, so re-runs never
//     clobber an existing opt-in date and re-sweeping is a no-op.
//
// Usage:
//   AIRTABLE_API_KEY=... DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 \
//     GAMES_LEAD_BASE_ID=app... GAMES_LEAD_TABLE_ID=tbl... \
//     npm run backfill:sms-consent            # dry run
//   ... npm run backfill:sms-consent -- --apply   # actually write
//
// Run it through the npm script, NOT `npx tsx` directly. lib/airtable/client.ts
// imports "server-only", which resolves to an empty module under the
// `react-server` export condition (what Next.js sets on the server) and to one
// that THROWS under every other condition. A plain tsx run therefore dies at
// import time, before a single line of this file executes, with a "cannot be
// imported from a Client Component" error that names neither this script nor the
// real cause. The npm script passes `--conditions=react-server`.
import { listRecords } from "../lib/airtable/client";
import { AIRTABLE_BASES } from "../lib/airtable/registry";
import { recordConsent } from "../lib/sms/consent";
import { toE164 } from "../lib/sms/send";
import { getSecret } from "../lib/ssm";

const APPLY = process.argv.includes("--apply");

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

type Source = { label: string; source: string; baseId: string; tableId: string };

type Tally = { consented: number; skippedNoOptIn: number; skippedBadPhone: number; unreadable?: string };

const API_ROOT = "https://api.airtable.com/v0";

/**
 * Ask Airtable whether this table is READABLE, separately from what it contains.
 *
 * listRecords() degrades to [] on any non-ok response — deliberate, so keyless
 * builds render empty instead of crashing. The cost is that "the token cannot
 * see this base" (403), "this ID is wrong" (404), and "this table is empty" are
 * one indistinguishable outcome: `0 record(s)`.
 *
 * That ambiguity is unacceptable here. This script's count is the evidence for
 * whether the campaign has an SMS list at all, and reading a 403 as "nobody ever
 * opted in" would retire a live channel on a permissions error. Probe, and say
 * which one it is. Returns null when readable.
 */
async function probeReadable(s: Source, key: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${API_ROOT}/${s.baseId}/${s.tableId}?maxRecords=1`, {
      headers: { Authorization: `Bearer ${key}` },
    });
  } catch (e) {
    return `could not reach Airtable — ${(e as Error).message}`;
  }
  if (res.ok) return null;
  if (res.status === 401 || res.status === 403) {
    return `HTTP ${res.status} — the workspace token cannot read this base. Add it to the ` +
      "personal access token's base allowlist in Airtable (a PAT only sees bases explicitly granted to it).";
  }
  if (res.status === 404) {
    return `HTTP 404 — base ${s.baseId} / table ${s.tableId} not found. Check the ID.`;
  }
  return `HTTP ${res.status} — unexpected response from Airtable.`;
}

async function backfillSource(s: Source, key: string): Promise<Tally> {
  const t: Tally = { consented: 0, skippedNoOptIn: 0, skippedBadPhone: 0 };

  const unreadable = await probeReadable(s, key);
  if (unreadable) {
    console.warn(`\n▶ ${s.label} — UNREADABLE, not empty`);
    console.warn(`  ${unreadable}`);
    console.warn("  This is NOT evidence that nobody opted in — the table was never read.");
    return { ...t, unreadable };
  }

  const records = await listRecords(s.baseId, s.tableId, {
    fields: ["Phone", "SMS Opt-In"],
    maxRecords: 100_000,
  });
  console.log(`\n▶ ${s.label} — ${records.length} record(s)`);

  for (const r of records) {
    // Affirmative opt-in only: an Airtable checkbox is `true` when checked, and the
    // field is absent otherwise. Anything that isn't literally true is not consent.
    if (r.fields["SMS Opt-In"] !== true) {
      t.skippedNoOptIn++;
      continue;
    }
    const raw = typeof r.fields.Phone === "string" ? r.fields.Phone : "";
    const e164 = toE164(raw);
    if (!e164) {
      t.skippedBadPhone++;
      continue;
    }
    t.consented++;
    console.log(`  ${APPLY ? "consent" : "would consent"}  ${e164}  (${s.source}${r.createdTime ? ` @ ${r.createdTime}` : ""})`);
    if (APPLY) {
      // Preserve the original opt-in time; if_not_exists means a live opt-in already
      // in the ledger keeps its own date.
      const ok = await recordConsent(e164, s.source, r.createdTime);
      if (!ok) die(`recordConsent returned false for ${e164} — is DYNAMODB_TABLE/AWS configured?`);
    }
  }
  return t;
}

async function main() {
  console.log(`Backfill SMS consent — ${APPLY ? "APPLY (writing to SMSCONSENT)" : "DRY RUN (no writes; pass --apply to write)"}`);

  const key = await getSecret("AIRTABLE_API_KEY");
  if (!key) {
    die("AIRTABLE_API_KEY is not set. The sources are Airtable bases; set the workspace token (env or SSM /matt-grant/AIRTABLE_API_KEY) and re-run.");
  }
  if (APPLY && !process.env.DYNAMODB_TABLE) {
    die("DYNAMODB_TABLE is not set. --apply writes the SMSCONSENT ledger in DynamoDB; set DYNAMODB_TABLE + AWS_REGION (and AWS creds) and re-run.");
  }

  const sources: Source[] = [];

  const gamesBase = await getSecret("GAMES_LEAD_BASE_ID");
  const gamesTable = await getSecret("GAMES_LEAD_TABLE_ID");
  if (gamesBase && gamesTable) {
    sources.push({ label: "Game leads", source: "games-lead-backfill", baseId: gamesBase, tableId: gamesTable });
  } else {
    console.warn("  note: GAMES_LEAD_BASE_ID/GAMES_LEAD_TABLE_ID unset — skipping the game-lead source.");
  }

  sources.push({
    label: "Volunteers roster",
    source: "volunteer-roster-backfill",
    baseId: AIRTABLE_BASES.volunteer.id,
    tableId: AIRTABLE_BASES.volunteer.tables.volunteers,
  });

  const totals: Tally = { consented: 0, skippedNoOptIn: 0, skippedBadPhone: 0 };
  const unreadable: string[] = [];
  for (const s of sources) {
    const t = await backfillSource(s, key);
    totals.consented += t.consented;
    totals.skippedNoOptIn += t.skippedNoOptIn;
    totals.skippedBadPhone += t.skippedBadPhone;
    if (t.unreadable) unreadable.push(s.label);
  }

  console.log("\n── Summary ──────────────────────────────────────────");
  console.log(`  ${APPLY ? "consented" : "would consent"}        : ${totals.consented}`);
  console.log(`  skipped (no opt-in)     : ${totals.skippedNoOptIn}`);
  console.log(`  skipped (bad phone)     : ${totals.skippedBadPhone}`);
  if (unreadable.length) {
    console.log(`  UNREADABLE sources      : ${unreadable.length} — ${unreadable.join(", ")}`);
  }
  if (!APPLY && totals.consented > 0) {
    console.log("\n  Dry run only — re-run with `-- --apply` to write these to the consent ledger.");
  }
  console.log("─────────────────────────────────────────────────────");

  if (unreadable.length) {
    // A zero here is not a finding. Exit non-zero so this can never be mistaken
    // for "the campaign has no consented contacts" in a log or a CI step.
    console.error(
      `\n✗ ${unreadable.length} source(s) could not be read, so this run proves nothing about who has opted in.\n` +
        "  Fix the access above and re-run before drawing any conclusion from the count.",
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n✗ Backfill failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
