// Staff / invite-list review — who is in the DynamoDB STAFF partition, which is the
// invite allowlist that grants internal dashboard access the moment an email signs up.
//
// WHY: the role-consistency audit (audit-roles.mjs) confirmed roles are consistent,
// but incidentally showed the STAFF list holds many press / government / outside
// addresses (several at captain level). This dumps the list — grouped by role,
// elevated first, with the forensic columns (invitedBy, createdAt) and an
// external-domain flag — so a human can decide who to prune.
//
// READ-ONLY by default. The only write path is an explicit, opt-in prune:
//   --remove a@b.com,c@d.com   → soft-removes those STAFF rows (status="removed")
//                                and demotes their Clerk role to "supporter".
//
// Run it in CloudShell (AWS creds automatic). Clerk key is OPTIONAL — with it, each
// row is annotated signed-up vs pending and --remove can also demote in Clerk:
//
//   cd ~/role-audit   # or anywhere with the two @aws-sdk packages installed
//   DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 \
//     [CLERK_SECRET_KEY=sk_live_...] node staff-list.mjs
//
//   # after reviewing, to prune (writes!):
//   DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 CLERK_SECRET_KEY=sk_live_... \
//     node staff-list.mjs --remove tips@latimes.com,publisher@nytimes.com

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.DYNAMODB_TABLE;
const CLERK_KEY = process.env.CLERK_SECRET_KEY; // optional
if (!TABLE) {
  console.error("Set DYNAMODB_TABLE=... (plus AWS creds). CLERK_SECRET_KEY is optional.");
  process.exit(2);
}

// Canonical role model — MIRROR of web/lib/rbac.ts (kept inline; plain-node ESM).
const ROLES = ["admin", "captain", "volunteer", "donor", "supporter", "partner"];
const ALIASES = { member: "volunteer", organizer: "volunteer" };
const asRole = (v) => (typeof v === "string" ? (ROLES.includes(v) ? v : (ALIASES[v] ?? null)) : null);
// Elevated tiers shown first — these are the rows worth scrutinizing.
const ROLE_ORDER = ["admin", "captain", "volunteer", "donor", "supporter", "partner", "(unknown)"];

// --- "looks external / not a campaign volunteer" heuristic (advisory only) ---------
const EXTERNAL_DOMAINS = [
  "nytimes.com", "latimes.com", "foxnews.com", "kcstar.com", "kfvs12.com", "fox4kc.com",
  "semissourian.com", "missouriindependent.com", "stlamerican.com", "firstalert4.com",
  "beehiiv.com", "aclu-mo.org",
];
const EXTERNAL_LOCALPARTS = new Set([
  "tips", "news", "newsroom", "editor", "publisher", "intake", "investigates", "speakout",
  "outreach", "contact", "press", "media", "info", "foxnewsinsider",
]);
function externalFlag(email) {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  if (domain.endsWith(".gov") || domain.endsWith(".mil")) return "gov/mil";
  if (EXTERNAL_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) return "press/org";
  if (EXTERNAL_LOCALPARTS.has(local)) return "role-addr";
  return "";
}

// --- DynamoDB (read) ----------------------------------------------------------------
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }),
);

async function loadStaff() {
  const rows = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": "STAFF" },
      ExclusiveStartKey,
    }));
    for (const i of r.Items ?? []) {
      rows.push({
        email: String(i.SK).trim().toLowerCase(),
        role: asRole(i.role) ?? "(unknown)",
        rawRole: i.role ?? null,
        status: i.status ?? "active",
        invitedBy: i.invitedBy ?? "",
        createdAt: i.createdAt ?? "",
      });
    }
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return rows;
}

// --- Clerk (optional read + the demote half of --remove) ----------------------------
const API = "https://api.clerk.com/v1";
const ch = { authorization: `Bearer ${CLERK_KEY}`, "content-type": "application/json" };

async function loadClerkEmails() {
  if (!CLERK_KEY) return null; // signed-up annotation unavailable
  const set = new Set();
  let offset = 0;
  for (;;) {
    const r = await fetch(`${API}/users?limit=100&offset=${offset}`, { headers: ch });
    if (!r.ok) throw new Error(`Clerk /users -> ${r.status} ${await r.text().catch(() => "")}`);
    const list = await r.json();
    const arr = Array.isArray(list) ? list : (list?.data ?? []);
    if (!arr.length) break;
    for (const u of arr) {
      for (const e of u.email_addresses ?? []) {
        if (e.email_address) set.add(e.email_address.trim().toLowerCase());
      }
    }
    offset += arr.length;
    if (arr.length < 100) break;
  }
  return set;
}

async function clerkDemoteToSupporter(email) {
  if (!CLERK_KEY) return "skipped (no CLERK_SECRET_KEY)";
  const r = await fetch(`${API}/users?email_address=${encodeURIComponent(email)}`, { headers: ch });
  if (!r.ok) return `lookup failed (${r.status})`;
  const list = await r.json();
  const user = (Array.isArray(list) ? list : (list?.data ?? []))[0];
  if (!user) return "no Clerk account (nothing to demote)";
  const u = await fetch(`${API}/users/${user.id}/metadata`, {
    method: "PATCH",
    headers: ch,
    body: JSON.stringify({ public_metadata: { role: "supporter" } }),
  });
  return u.ok ? "demoted to supporter" : `demote failed (${u.status})`;
}

async function softRemoveStaff(email) {
  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: "STAFF", SK: email.trim().toLowerCase() },
    UpdateExpression: "SET #s = :r",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":r": "removed" },
  }));
}

// --- CLI ----------------------------------------------------------------------------
function parseRemoveArg() {
  const argv = process.argv.slice(2);
  const i = argv.findIndex((a) => a === "--remove" || a.startsWith("--remove="));
  if (i === -1) return [];
  const inline = argv[i].includes("=") ? argv[i].split("=")[1] : argv[i + 1];
  return (inline ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

async function main() {
  const removeList = parseRemoveArg();
  const [staff, clerkEmails] = await Promise.all([loadStaff(), loadClerkEmails().catch((e) => {
    console.warn(`(Clerk annotation unavailable: ${e.message})`);
    return null;
  })]);

  // ---- PRUNE MODE (explicit, writes) ----
  if (removeList.length) {
    console.log(`PRUNE — soft-removing ${removeList.length} STAFF row(s) + demoting Clerk role:\n`);
    const byEmail = new Map(staff.map((s) => [s.email, s]));
    for (const email of removeList) {
      if (!byEmail.has(email)) { console.log(`  • ${email}: not in STAFF (skipped)`); continue; }
      try {
        await softRemoveStaff(email);
        const clerk = await clerkDemoteToSupporter(email);
        console.log(`  • ${email}: STAFF status="removed"; Clerk ${clerk}`);
      } catch (e) {
        console.log(`  • ${email}: FAILED — ${e.message}`);
      }
    }
    console.log("\nDone. Re-run without --remove to see the updated list.");
    return;
  }

  // ---- REVIEW MODE (read-only) ----
  const active = staff.filter((s) => s.status !== "removed");
  console.log("Staff / invite-list review — READ ONLY\n" + "=".repeat(52));
  console.log(`${staff.length} rows (${active.length} active). ` +
    (clerkEmails ? "signed-up = has a Clerk account." : "Set CLERK_SECRET_KEY to annotate signed-up vs pending."));
  console.log("Flags: [EXT:…] = address looks external (press/gov/role-addr) — advisory, review.\n");

  const byRole = new Map(ROLE_ORDER.map((r) => [r, []]));
  for (const s of active) (byRole.get(s.role) ?? byRole.get("(unknown)")).push(s);

  let extCount = 0;
  for (const role of ROLE_ORDER) {
    const rows = byRole.get(role) ?? [];
    if (!rows.length) continue;
    console.log(`\n### ${role.toUpperCase()} (${rows.length})`);
    rows.sort((a, b) => a.email.localeCompare(b.email));
    for (const s of rows) {
      const ext = externalFlag(s.email);
      if (ext) extCount++;
      const signed = clerkEmails ? (clerkEmails.has(s.email) ? "signed-up" : "pending") : "";
      const tags = [signed, ext ? `EXT:${ext}` : ""].filter(Boolean).join(" ");
      const meta = [s.invitedBy && `by ${s.invitedBy}`, s.createdAt && s.createdAt.slice(0, 10)].filter(Boolean).join("  ");
      console.log(`  - ${s.email.padEnd(38)} ${tags.padEnd(20)} ${meta}`);
    }
  }

  console.log("\n" + "=".repeat(52));
  console.log(`${extCount} row(s) flagged external-looking. Review the ADMIN/CAPTAIN groups first.`);
  console.log("To prune (writes): node staff-list.mjs --remove email1,email2  (soft-removes + demotes Clerk).");
}

main().catch((e) => { console.error("Failed:", e?.message ?? e); process.exit(1); });
