// One-off normalization of legacy role values → canonical, in both stores.
//
// WHY: the rename member→volunteer shipped with NO data migration (asRole() coerces
// on read), so the raw stored strings can still be "member"/"organizer". The audit
// (audit-roles.mjs) found 97 such values — ~7 in Clerk publicMetadata, ~90 in the
// DynamoDB STAFF rows. They resolve correctly everywhere; this just rewrites the raw
// value to match, so exports / the Clerk dashboard read cleanly and the alias map can
// eventually be retired. PURELY COSMETIC — behavior is identical before and after.
//
// SAFE: DRY-RUN by default (no writes); pass --apply to write. Idempotent — only rows
// whose raw value differs from its canonical role are touched. Never touches the audit
// log (that's history) or any non-legacy value.
//
// Run in CloudShell (AWS creds automatic). Both env vars recommended; each half is
// skipped if its credential is absent.
//
//   cd ~/role-audit
//   # 1) preview (no writes):
//   CLERK_SECRET_KEY=sk_live_... DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 node normalize-roles.mjs
//   # 2) apply:
//   CLERK_SECRET_KEY=sk_live_... DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 node normalize-roles.mjs --apply

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const CLERK_KEY = process.env.CLERK_SECRET_KEY; // needed for the Clerk half
const TABLE = process.env.DYNAMODB_TABLE; // needed for the STAFF half
const APPLY = process.argv.slice(2).includes("--apply");
if (!CLERK_KEY && !TABLE) {
  console.error("Set CLERK_SECRET_KEY and/or DYNAMODB_TABLE (plus AWS creds). Add --apply to write.");
  process.exit(2);
}

// Canonical role model — MIRROR of web/lib/rbac.ts (kept inline; plain-node ESM).
const ROLES = ["admin", "captain", "volunteer", "donor", "supporter", "partner"];
const ALIASES = { member: "volunteer", organizer: "volunteer" };
const asRole = (v) => (typeof v === "string" ? (ROLES.includes(v) ? v : (ALIASES[v] ?? null)) : null);
const isLegacyAlias = (v) => typeof v === "string" && v in ALIASES; // member/organizer

const API = "https://api.clerk.com/v1";
const ch = { authorization: `Bearer ${CLERK_KEY}`, "content-type": "application/json" };
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }),
);

const primaryEmail = (u) => {
  const l = u.email_addresses ?? [];
  const p = l.find((e) => e.id === u.primary_email_address_id) ?? l[0];
  return p?.email_address?.trim().toLowerCase() ?? null;
};

// Find Clerk users whose raw publicMetadata.role is a legacy alias.
async function findClerkLegacy() {
  const out = [];
  let offset = 0;
  for (;;) {
    const r = await fetch(`${API}/users?limit=100&offset=${offset}`, { headers: ch });
    if (!r.ok) throw new Error(`Clerk /users -> ${r.status} ${await r.text().catch(() => "")}`);
    const list = await r.json();
    const arr = Array.isArray(list) ? list : (list?.data ?? []);
    if (!arr.length) break;
    for (const u of arr) {
      const raw = u.public_metadata?.role ?? null;
      if (isLegacyAlias(raw)) out.push({ id: u.id, email: primaryEmail(u) ?? u.id, raw, to: asRole(raw) });
    }
    offset += arr.length;
    if (arr.length < 100) break;
  }
  return out;
}

async function patchClerkRole(id, role) {
  const r = await fetch(`${API}/users/${id}/metadata`, {
    method: "PATCH",
    headers: ch,
    body: JSON.stringify({ public_metadata: { role } }), // merges — preserves other keys
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => "")}`);
}

// Find STAFF rows whose raw role is a legacy alias.
async function findStaffLegacy() {
  const out = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": "STAFF" },
      ExclusiveStartKey,
    }));
    for (const i of r.Items ?? []) {
      if (isLegacyAlias(i.role)) out.push({ email: String(i.SK), raw: i.role, to: asRole(i.role) });
    }
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function setStaffRole(email, role) {
  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: "STAFF", SK: email },
    UpdateExpression: "SET #r = :role",
    ExpressionAttributeNames: { "#r": "role" },
    ExpressionAttributeValues: { ":role": role },
  }));
}

async function main() {
  console.log(`Normalize legacy role values — ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}\n` + "=".repeat(52));

  const clerk = CLERK_KEY ? await findClerkLegacy() : [];
  const staff = TABLE ? await findStaffLegacy() : [];
  if (!CLERK_KEY) console.log("(CLERK_SECRET_KEY not set — skipping the Clerk half)");
  if (!TABLE) console.log("(DYNAMODB_TABLE not set — skipping the STAFF half)");

  console.log(`\nClerk publicMetadata.role to normalize: ${clerk.length}`);
  clerk.forEach((c) => console.log(`  - ${c.email}: "${c.raw}" -> "${c.to}"`));
  console.log(`\nDynamoDB STAFF rows to normalize: ${staff.length}`);
  staff.forEach((s) => console.log(`  - ${s.email}: "${s.raw}" -> "${s.to}"`));

  if (!APPLY) {
    console.log("\n" + "=".repeat(52));
    console.log(`DRY RUN — would update ${clerk.length} Clerk + ${staff.length} STAFF. Re-run with --apply to write.`);
    return;
  }

  let okC = 0, okS = 0, fail = 0;
  console.log("\nApplying Clerk updates…");
  for (const c of clerk) {
    try { await patchClerkRole(c.id, c.to); okC++; }
    catch (e) { fail++; console.log(`  ! ${c.email}: ${e.message}`); }
  }
  console.log("Applying STAFF updates…");
  for (const s of staff) {
    try { await setStaffRole(s.email, s.to); okS++; }
    catch (e) { fail++; console.log(`  ! ${s.email}: ${e.message}`); }
  }
  console.log("\n" + "=".repeat(52));
  console.log(`APPLIED — Clerk ${okC}/${clerk.length}, STAFF ${okS}/${staff.length}${fail ? `, ${fail} failed` : ""}.`);
  console.log("Verify: re-run audit-roles.mjs → expect 0 legacy-but-resolvable values.");
}

main().catch((e) => { console.error("Normalize failed:", e?.message ?? e); process.exit(1); });
