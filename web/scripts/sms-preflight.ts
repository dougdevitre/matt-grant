/**
 * SMS pre-flight report — run with tsx:
 *
 *   DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 \
 *     npm run sms:preflight -- [--budget 500] [--segments 1] [--preset gotv-chase]
 *
 * READ-ONLY. Sends nothing, writes nothing. Answers the questions you need
 * answered BEFORE pressing send:
 *
 *   • How many people can we actually text?  (the consent ledger IS the ceiling)
 *   • What will this cost, and when will it finish?
 *   • Will it split into multiple campaign rows, and is the audience healthy?
 *
 * On "how do I know who's opted in": the SMSCONSENT partition, SK = the E.164
 * phone, attribute `status`. It is DEFAULT-DENY — `isOptedIn()` returns true only
 * on an explicit "opted_in" row, so a number with no row is never textable. No
 * voter file, purchased list, or appended phone is in this universe (TCPA;
 * candidate/voter-file-plan.md §2.3).
 *
 * COUNTS ONLY — no phone number, name, or other PII is ever printed.
 */
// NOTE: lib/sms/health.ts and lib/reports/smsInsights.ts are marked `server-only`
// and cannot be imported from a CLI, so the couple of numbers this needs from
// them are computed inline below against the same sources.
import { listConsent } from "../lib/sms/consent";
import { getSecret } from "../lib/ssm";
import { optinGrowth } from "../lib/reports/optinGrowth";
import { SMS_PRICING_DEFAULTS, spendModel } from "../lib/reports/smsSpend";
import { SMS_DRAIN_PER_MINUTE, estimateDrainCompletion, formatEtaCT } from "../lib/sms/pacing";
import { SMS_PRIORITY_PRESETS, presetTokens, parseTargetToken, OUTSTANDING_TOKEN } from "../lib/sms/audiences";
import { chunkRecipients } from "../lib/sms/campaigns";
import { PK, TABLE, queryAllPages } from "../lib/db";

const TWILIO_SECRETS = [
  ["TWILIO_ACCOUNT_SID", "Account SID"],
  ["TWILIO_AUTH_TOKEN", "Auth token"],
  ["TWILIO_MESSAGING_SERVICE_SID", "Messaging Service SID"],
] as const;

/** Which Twilio secrets are present. Reports presence ONLY — never a value. */
async function twilioSecretState(): Promise<{ present: string[]; missing: string[] }> {
  const present: string[] = [];
  const missing: string[] = [];
  for (const [key, label] of TWILIO_SECRETS) {
    const v = await getSecret(key).catch(() => undefined);
    (v ? present : missing).push(label);
  }
  return { present, missing };
}

/** Total voters in the file, summed from the precinct rollups. Context only —
 *  this number is emphatically NOT textable. */
async function voterFileCount(): Promise<number> {
  try {
    const aggs = await queryAllPages({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": PK.voterAgg },
    });
    return aggs.reduce((n, a) => n + (typeof a.count === "number" ? a.count : 0), 0);
  } catch {
    return 0;
  }
}

const args = process.argv.slice(2);
const opt = (name: string, dflt: string): string => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const pct = (n: number, d: number): string => (d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}%`);
const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
const pad = (s: string, n: number): string => s.padEnd(n);
const num = (n: number): string => n.toLocaleString();

async function main() {
  if (!TABLE) {
    console.error("Set DYNAMODB_TABLE (read-only report).");
    process.exit(1);
  }
  const budgetDollars = Number(opt("--budget", "0"));
  const segments = Math.max(1, Number(opt("--segments", "1")));
  const growthDays = Math.max(1, Number(opt("--days", "9")));

  const [rows, secrets, voters] = await Promise.all([listConsent(), twilioSecretState(), voterFileCount()]);

  // ── Twilio configuration ───────────────────────────────────────────────────
  console.log("\n=== TWILIO ===");
  console.log(`Credentials: ${secrets.missing.length === 0 ? "all present" : `INCOMPLETE — missing ${secrets.missing.join(", ")}`}`);
  console.log(
    "Toll-Free Verification is NOT checked here (no API for it in this app). Confirm it reads\n" +
      "  Verified in the Twilio console — unverified sends fail at the carrier with error 30032.",
  );

  // ── The textable universe ──────────────────────────────────────────────────
  const optedIn = rows.filter((r) => r.status === "opted_in");
  const optedOut = rows.filter((r) => r.status === "opted_out");
  const total = optedIn.length + optedOut.length;

  const scored = optedIn.filter((r) => r.voterSegment).length;
  const lastEnrichedAt = rows.reduce<string | null>((max, r) => (r.enrichedAt && (!max || r.enrichedAt > max) ? r.enrichedAt : max), null);

  console.log("\n=== TEXTABLE UNIVERSE (the ceiling on any blast) ===");
  console.log(`Opted in (textable):    ${num(optedIn.length)}`);
  console.log(`Opted out (suppressed): ${num(optedOut.length)}  ${pct(optedOut.length, total)} of everyone who ever joined`);
  console.log(`Scored (voter-matched): ${num(scored)}  ${pct(scored, optedIn.length)} of opted-in`);
  console.log(`Last enrichment:        ${lastEnrichedAt ?? "never"}`);
  if (voters > 0) {
    console.log(
      `\nThe voter file holds ${num(voters)} records — that is NOT a textable number.\n` +
        "  Reaching them means their own opt-in, a manual-dial call program, peer-to-peer\n" +
        "  texting, or hashed digital audiences (scripts/export-digital-audience.ts).",
    );
  }
  if (optedIn.length === 0) {
    console.log("\nNo opted-in numbers — there is nothing to send. Grow the list first (see below).");
  }

  // ── Opt-in growth ──────────────────────────────────────────────────────────
  const growth = optinGrowth(rows, { days: growthDays });
  console.log(`\n=== OPT-IN GROWTH (last ${growth.windowDays} days) ===`);
  console.log(`New opt-ins: ${num(growth.recentOptIns)}  (${(growth.recentOptIns / growth.windowDays).toFixed(1)}/day)`);
  for (const s of growth.bySource.slice(0, 8)) {
    console.log(`  ${pad(s.label, 24)} ${String(num(s.count)).padStart(7)}  ${s.pct.toFixed(1)}%`);
  }

  // ── Reach per preset ───────────────────────────────────────────────────────
  // Mirrors the composer's filters exactly so the numbers here can't diverge from
  // what a send would actually resolve to.
  const matches = (row: (typeof rows)[number], tokens: string[]): boolean => {
    for (const t of tokens) {
      const p = parseTargetToken(t);
      if (!p) continue;
      if (p.kind === "segment" && row.voterSegment !== p.value) return false;
      if (p.kind === "county" && row.county !== p.value) return false;
      if (p.kind === "party" && row.voterParty !== p.value) return false;
      if (p.kind === "pp" && !(typeof row.voterPp === "number" && row.voterPp >= p.min)) return false;
      if (p.kind === "outstanding" && row.banked === true) return false;
    }
    return true;
  };

  console.log("\n=== REACH BY PRESET ===");
  const reach = new Map<string, number>();
  for (const preset of SMS_PRIORITY_PRESETS) {
    const tokens = presetTokens(preset);
    const n = tokens.length === 0 ? optedIn.length : optedIn.filter((r) => matches(r, tokens)).length;
    reach.set(preset.value, n);
    console.log(`  ${pad(preset.value, 22)} ${String(num(n)).padStart(7)}   ${preset.label}`);
  }
  const outstanding = optedIn.filter((r) => r.banked !== true).length;
  console.log(`  ${pad(OUTSTANDING_TOKEN, 22)} ${String(num(outstanding)).padStart(7)}   Not yet voted (chase suppression)`);

  // ── Cost, capacity, and timing for the selected audience ───────────────────
  const presetArg = opt("--preset", "all");
  const listSize = reach.get(presetArg) ?? optedIn.length;
  const budgetCents = Math.round(budgetDollars * 100);
  const spend = spendModel({ ...SMS_PRICING_DEFAULTS, segments, listSize, sends: 1, budgetCents });
  const willSend = spend.capPerBlast !== null ? Math.min(spend.capPerBlast, listSize) : listSize;

  console.log(`\n=== THIS SEND — preset "${presetArg}", ${segments} segment(s) ===`);
  console.log(`Audience:        ${num(listSize)}`);
  console.log(`Cost per text:   ${money(spend.perTextCents)}   (incl. expected replies)`);
  console.log(`Full blast cost: ${money(spend.perBlastCents)}`);
  if (budgetCents > 0) {
    console.log(
      spend.capPerBlast === null
        ? `Budget ${money(budgetCents)}: covers the whole list.`
        : `Budget ${money(budgetCents)}: caps at ${num(spend.capPerBlast)} (${spend.coveragePct.toFixed(1)}% of the list).\n` +
            "  The cap trims the LOWEST-priority tail — the GOTV core is still reached first.",
    );
  } else {
    console.log("Budget:          not set (pass --budget to see the cap and coverage).");
  }

  // Chunking: how many campaign rows this becomes.
  const chunks = chunkRecipients(Array.from({ length: willSend }, () => ({ phone: "+13145550000", first: "Sam" })));
  console.log(`Campaign rows:   ${chunks.length}${chunks.length > 1 ? " (splits automatically; they drain back-to-back in priority order)" : ""}`);

  // Timing.
  const est = estimateDrainCompletion(willSend);
  console.log(`Throughput:      ~${SMS_DRAIN_PER_MINUTE}/min inside the 9am-8pm CT window`);
  console.log(`Send time:       ~${Math.ceil(est.sendMinutes)} min of actual sending`);
  console.log(`Finishes:        ~${formatEtaCT(est.eta)}`);
  if (est.spansWindows) {
    console.log(
      "  ** This send does NOT finish today — it pauses at 8pm CT and resumes at 9am. **\n" +
        "  For an election-day message that is usually the wrong outcome: cut the audience,\n" +
        "  raise SMS_DRAIN_BATCH / SMS_DRAIN_BATCHES_PER_RUN, or start earlier in the day.",
    );
  }

  // ── Health guardrails ──────────────────────────────────────────────────────
  console.log("\n=== BEFORE YOU SEND ===");
  const optOutRate = total === 0 ? 0 : (optedOut.length / total) * 100;
  console.log(
    `Lifetime opt-out rate ${optOutRate.toFixed(1)}% — ` +
      (optOutRate < 2 ? "healthy." : optOutRate <= 5 ? "CAUTION: review targeting and frequency." : "STOP: diagnose before sending again."),
  );
  console.log("  (Per-send opt-out rate is the number that actually matters — re-run this after each send.)");
  console.log("Checklist: message reads 1 segment and flags no non-GSM characters (a curly quote or");
  console.log("  em dash doubles the cost of the whole blast) · sent a staff test first · the send");
  console.log("  finishes before it stops being true (polls close 7pm Aug 4).");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
