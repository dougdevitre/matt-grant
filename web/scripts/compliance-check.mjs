// Compliance guardrail for Matt Grant for Congress (web).
//
// Enforces the rules in docs/compliance-baseline.md so they can't silently
// regress. Fails (exit 1) if a required FEC/CAN-SPAM control is missing from a
// content surface, if claim-integrity rules are violated, or if the election
// date drifts. Run locally with `npm run compliance`; wire into CI to gate
// deploys.
//
// Educational automation, not legal advice — keep docs/compliance-baseline.md
// as the source of truth and have counsel confirm before relying on it.

import { readFileSync, existsSync } from "node:fs";

const fails = [];
const warns = [];
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);
// Strip // line comments and /* */ blocks so guard-comments don't trip the
// claim scanner (we test the actual shipped copy, not the reminders about it).
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function mustExist(path) {
  const c = read(path);
  if (c === null) fail(`Missing required file: ${path}`);
  return c;
}

// 1. Central disclaimer string is the single source of truth ------------------
const site = mustExist("lib/site.ts");
if (site) {
  if (!/paidForBy:\s*"Paid for by Matt Grant for Congress\."/.test(site))
    fail("lib/site.ts: CAMPAIGN.paidForBy must be the exact authorized-committee disclaimer.");
  if (!/committee:\s*"Matt Grant for Congress"/.test(site))
    fail("lib/site.ts: CAMPAIGN.committee changed — update guardrail + all surfaces.");
}

// 2. Required surfaces must reference the central paid-for-by string -----------
const paidForBySurfaces = [
  "components/SiteFooter.tsx",
  "lib/email/layout.ts",
  "app/api/graphics/route.tsx",
  "app/(site)/donate/page.tsx",
];
for (const p of paidForBySurfaces) {
  const c = mustExist(p);
  if (c && !/CAMPAIGN\.paidForBy/.test(c))
    fail(`${p}: public communication surface must render CAMPAIGN.paidForBy (FEC 11 CFR 110.11).`);
}

// 3. Mass-email footer: postal address + working unsubscribe (CAN-SPAM) --------
const emailLayout = read("lib/email/layout.ts");
if (emailLayout) {
  if (!/CAMPAIGN\.address/.test(emailLayout))
    fail("lib/email/layout.ts: mass email must include the committee postal address (CAN-SPAM).");
  if (!/unsubscribe/i.test(emailLayout))
    fail("lib/email/layout.ts: mass email must include an unsubscribe mechanism (CAN-SPAM).");
}

// 4. Solicitation notices on the donate / fundraising surface -----------------
const donate = read("app/(site)/donate/page.tsx");
if (donate) {
  const notices = [
    [/not tax-deductible/i, "not-tax-deductible notice"],
    [/best efforts/i, "best-efforts (name/address/occupation/employer) notice"],
    [/own funds/i, "own-funds attestation"],
    [/citizen|permanent resident/i, "citizen / lawful permanent resident eligibility"],
    [/corporation|foreign national/i, "prohibited-source statement"],
  ];
  for (const [re, label] of notices)
    if (!re.test(donate)) fail(`donate/page.tsx: missing solicitation ${label} (FEC fundraising notices).`);
}

// 5. Claim integrity in public content data (no invented polls/endorsements) ---
const contentFiles = ["lib/socialPosts.ts", "lib/issues.ts", "lib/pressTopics.ts"];
const bannedClaims = [
  [/\bendorsed by\b/i, "endorsement claim"],
  [/\bpoll(s|ing)?\s+(show|shows|found|has)\b/i, "poll-result claim"],
  [/\b\d{1,3}%\s+of\s+(voters|likely|the)/i, "voter-percentage statistic"],
  [/#1\b|\bnumber one\b|\bleading candidate\b/i, "superlative ranking claim"],
  [/\bguarantee(d|s)?\b/i, "guarantee language"],
];
for (const p of contentFiles) {
  const c = read(p);
  if (!c) continue;
  const body = stripComments(c);
  for (const [re, label] of bannedClaims) {
    const m = body.match(re);
    if (m) fail(`${p}: possible ${label} ("${m[0]}") — verify against platform.md or remove (no invented facts).`);
  }
}

// 6. Election-date consistency (wrong voter info = highest-risk content) -------
const EXPECTED_DATE = "August 4, 2026";
if (site && !site.includes(EXPECTED_DATE))
  fail(`lib/site.ts: electionLabel must be "${EXPECTED_DATE}".`);

// 7. Drift warning: hard-coded disclaimer copies that bypass the central string
//    (allowed on standalone surfaces like error.tsx that render no footer).
// error.tsx renders no footer; site.ts defines the string; the .mjs generators
// are standalone Node (can't import the TS CAMPAIGN constant) and are covered by
// the paid-for-by surface checks above.
const allowHardcoded = new Set(["app/error.tsx", "lib/site.ts"]);
const allowHardcodedRe = /^scripts\/.*\.mjs$/;
import { readdirSync, statSync } from "node:fs";
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next") continue;
    const full = `${dir}/${e}`;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs)$/.test(e)) out.push(full);
  }
  return out;
}
for (const f of walk(".")) {
  if (f.includes("/scripts/compliance-check.mjs")) continue;
  const rel = f.replace(/^\.\//, "");
  if (allowHardcoded.has(rel) || allowHardcodedRe.test(rel)) continue;
  const c = read(f);
  if (c && /Paid for by Matt Grant for Congress/.test(stripComments(c)) && !/CAMPAIGN\.paidForBy/.test(c)) {
    // Descriptive prose mentions are fine; flag only as a drift warning.
    warn(`${rel}: hard-codes the disclaimer string instead of CAMPAIGN.paidForBy (drift risk if committee name changes).`);
  }
}

// Report ----------------------------------------------------------------------
for (const w of warns) console.warn(`⚠️  ${w}`);
if (fails.length) {
  console.error(`\n❌ Compliance check FAILED (${fails.length}):`);
  for (const f of fails) console.error(`   • ${f}`);
  console.error(`\nSee docs/compliance-baseline.md for the controlling rules.`);
  process.exit(1);
}
console.log(`✅ Compliance check passed${warns.length ? ` (${warns.length} warning${warns.length > 1 ? "s" : ""})` : ""}.`);
