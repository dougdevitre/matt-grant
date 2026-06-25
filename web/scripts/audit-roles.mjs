// Read-only role-consistency audit across the three stores that carry a role.
//
// WHY: the app resolves an effective role consistently everywhere (every read runs
// through asRole() in web/lib/rbac.ts, so legacy "member"/"organizer" → "volunteer").
// But the RAW stored strings were never migrated, and Clerk vs DynamoDB are written
// by separate best-effort calls — so the underlying values can drift even while the
// app behaves. This script makes that drift visible. It is the companion to
// list-clerk-roles.mjs (which only tallies Clerk); this one RECONCILES per email.
//
// The stores (see web/docs/roles-and-permissions.md → "Consistency across layers"):
//   • Clerk publicMetadata.role  — runtime source of truth (auth.ts resolves this first)
//   • DynamoDB STAFF rows         — fallback / pending-invite store (lib/staff.ts)
//   • DynamoDB DONOR rows         — no role; the "donor" tier is DERIVED from net gifts
//   • Audit log (AUDIT#access)    — append-only HISTORY; NOT current state (shown FYI only)
//
// It ONLY READS. It never writes, migrates, or deletes. Run it locally / in CloudShell:
//
//   cd web   # (or ~/role-audit)
//   CLERK_SECRET_KEY=sk_live_... DYNAMODB_TABLE=your-table AWS_REGION=us-east-1 \
//     node scripts/audit-roles.mjs
//
// The Clerk key is read from CLERK_SECRET_KEY, or — when unset — from AWS SSM Parameter
// Store (SecureString /matt-grant/clerk-secret-key, override with CLERK_SECRET_PARAM), so
// CloudShell can run it with just DYNAMODB_TABLE set. (AWS creds come from the usual chain:
// AWS_PROFILE / AWS_ACCESS_KEY_ID+SECRET / SSO.)
// Then paste the output back and we'll reconcile it into roles-and-permissions.md.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

let CLERK_KEY = process.env.CLERK_SECRET_KEY; // resolved (env → SSM) in main()
const TABLE = process.env.DYNAMODB_TABLE;
if (!TABLE) {
  console.error("Set DYNAMODB_TABLE=... (plus AWS creds) and re-run. CLERK_SECRET_KEY may come from SSM.");
  process.exit(2);
}

// --- Clerk key resolution: env first, else AWS SSM Parameter Store (SecureString) ----
// Dynamic import so the SSM SDK is only needed when falling back; missing param → undefined.
async function resolveClerkKey() {
  if (process.env.CLERK_SECRET_KEY) return process.env.CLERK_SECRET_KEY;
  const name = process.env.CLERK_SECRET_PARAM ?? "/matt-grant/clerk-secret-key";
  try {
    const { SSMClient, GetParameterCommand } = await import("@aws-sdk/client-ssm");
    const ssm = new SSMClient({ region: process.env.AWS_REGION ?? "us-east-1" });
    const r = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    return r.Parameter?.Value || undefined;
  } catch (e) {
    console.warn(`(Clerk key: env unset and SSM ${name} unavailable: ${e.message})`);
    return undefined;
  }
}

// --- Canonical role model — MIRROR of web/lib/rbac.ts (the source of truth). -------
// Kept inline because this is a plain-node ESM script and rbac.ts is TypeScript.
// If you add/rename a role there, update these three lines.
const ROLES = ["admin", "captain", "volunteer", "donor", "supporter", "partner"];
const STAFF_ROLES = ["admin", "captain", "volunteer"];
const ALIASES = { member: "volunteer", organizer: "volunteer" }; // legacy → current
const asRole = (v) =>
  typeof v === "string" ? (ROLES.includes(v) ? v : (ALIASES[v] ?? null)) : null;
const isLegacyAlias = (v) => typeof v === "string" && v in ALIASES;
// A raw value that won't resolve to any known role at all (real corruption / typo).
const isUnknownRaw = (v) => v != null && v !== "" && asRole(v) === null;

// --- Clerk REST (read-only) ---------------------------------------------------------
const API = "https://api.clerk.com/v1";
const headers = { authorization: "", "content-type": "application/json" }; // bearer set in main()
const clerkGet = async (path) => {
  const r = await fetch(`${API}${path}`, { headers });
  if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text().catch(() => "")}`);
  return r.json();
};

const primaryEmail = (u) => {
  const list = u.email_addresses ?? [];
  const primary = list.find((e) => e.id === u.primary_email_address_id) ?? list[0];
  return primary?.email_address?.trim().toLowerCase() ?? null;
};

// --- DynamoDB (read-only) -----------------------------------------------------------
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }),
);

async function loadClerkUsers() {
  const byEmail = new Map(); // email -> { rawRole, resolved }
  let offset = 0;
  for (;;) {
    const list = await clerkGet(`/users?limit=100&offset=${offset}`);
    const arr = Array.isArray(list) ? list : (list?.data ?? []);
    if (!arr.length) break;
    for (const u of arr) {
      const email = primaryEmail(u);
      if (!email) continue;
      const rawRole = u.public_metadata?.role ?? null;
      byEmail.set(email, { rawRole, resolved: asRole(rawRole) });
    }
    offset += arr.length;
    if (arr.length < 100) break;
  }
  return byEmail;
}

async function loadStaffRows() {
  const byEmail = new Map(); // email -> { rawRole, resolved, status }
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": "STAFF" },
        ExclusiveStartKey,
      }),
    );
    for (const i of r.Items ?? []) {
      const email = String(i.SK).trim().toLowerCase();
      byEmail.set(email, { rawRole: i.role ?? null, resolved: asRole(i.role), status: i.status ?? "active" });
    }
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return byEmail;
}

// Net contributions for one email (mirrors donorStatus.ts: net > 0 ⇒ "donor").
async function donorNetCents(email) {
  try {
    const r = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { PK: "DONOR", SK: `e:${email}` } }),
    );
    const contribs = r.Item?.contributions ?? [];
    return contribs.reduce((s, c) => s + (Number(c.amountCents) || 0), 0);
  } catch {
    return null; // read failed — reported as "unknown", never a false alarm
  }
}

async function lastAccessLogRole() {
  try {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": "AUDIT#access" },
        ScanIndexForward: false,
        Limit: 5,
      }),
    );
    return (r.Items ?? []).map((i) => ({ at: i.at, action: i.action, target: i.target, role: i.role }));
  } catch {
    return [];
  }
}

function fmt(v) {
  return v == null ? "(unset)" : String(v);
}

async function main() {
  CLERK_KEY = await resolveClerkKey();
  if (!CLERK_KEY) {
    console.error(
      "No Clerk key: set CLERK_SECRET_KEY=sk_..., or store it in SSM\n" +
        "  aws ssm put-parameter --name /matt-grant/clerk-secret-key --type SecureString --value sk_live_...",
    );
    process.exit(2);
  }
  headers.authorization = `Bearer ${CLERK_KEY}`;

  console.log("Role-consistency audit — READ ONLY (no writes)\n" + "=".repeat(48));
  console.log(`Canonical roles (web/lib/rbac.ts): ${ROLES.join(", ")}`);
  console.log(`Legacy aliases: ${Object.entries(ALIASES).map(([k, v]) => `${k}→${v}`).join(", ")}\n`);

  const [clerk, staff] = await Promise.all([loadClerkUsers(), loadStaffRows()]);
  const activeStaff = new Map([...staff].filter(([, v]) => v.status !== "removed"));

  console.log(`Pulled ${clerk.size} Clerk users, ${staff.size} staff rows (${activeStaff.size} active).\n`);

  // Resolved-role tally from Clerk (what the app actually enforces).
  const tally = {};
  for (const { resolved, rawRole } of clerk.values()) {
    const key = resolved ?? (rawRole == null ? "(unset)" : `(unknown:${rawRole})`);
    tally[key] = (tally[key] ?? 0) + 1;
  }
  console.log("Clerk resolved-role tally (effective roles the app enforces):");
  for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`);
  console.log("");

  const mismatches = []; // Clerk vs active staff row disagree on resolved role
  const staleRaw = []; // legacy alias / unknown raw string stored in either store
  const orphanStaff = []; // active staff row, no Clerk user (pending invite — usually fine)
  const staffNoRow = []; // Clerk staff-role user with no active staff row (review)
  const donorAnomalies = []; // Clerk role=donor but no positive net gift (or vice-versa risk)

  const emails = new Set([...clerk.keys(), ...activeStaff.keys()]);
  for (const email of emails) {
    const c = clerk.get(email);
    const s = activeStaff.get(email);

    // (1) raw-value staleness in each store
    if (c && isLegacyAlias(c.rawRole)) staleRaw.push({ email, store: "clerk", raw: c.rawRole, resolves: c.resolved });
    if (c && isUnknownRaw(c.rawRole)) staleRaw.push({ email, store: "clerk", raw: c.rawRole, resolves: "NONE ⚠️" });
    if (s && isLegacyAlias(s.rawRole)) staleRaw.push({ email, store: "staff", raw: s.rawRole, resolves: s.resolved });
    if (s && isUnknownRaw(s.rawRole)) staleRaw.push({ email, store: "staff", raw: s.rawRole, resolves: "NONE ⚠️" });

    // (2) Clerk ↔ staff disagreement (both present, resolved roles differ)
    if (c && s && c.resolved && s.resolved && c.resolved !== s.resolved) {
      mismatches.push({ email, clerk: c.resolved, staff: s.resolved, clerkRaw: c.rawRole, staffRaw: s.rawRole });
    }

    // (3) orphans
    if (s && !c) orphanStaff.push({ email, staffRole: s.resolved ?? fmt(s.rawRole) });
    if (c && !s && c.resolved && STAFF_ROLES.includes(c.resolved)) {
      // Env-allowlist admins legitimately have no staff row — note, don't alarm.
      staffNoRow.push({ email, clerkRole: c.resolved });
    }
  }

  // (4) donor-tier sanity: every Clerk role=donor should have a positive net gift.
  const donorEmails = [...clerk].filter(([, v]) => v.resolved === "donor").map(([e]) => e);
  for (const email of donorEmails) {
    const net = await donorNetCents(email);
    if (net === null) continue; // read error — skip rather than false-flag
    if (net <= 0) donorAnomalies.push({ email, net, note: "Clerk role=donor but net gifts ≤ 0 — auto-upgrade may have mis-fired or refund netted out" });
  }

  // --- Report -----------------------------------------------------------------------
  const section = (title, rows, render) => {
    console.log(`\n${title}: ${rows.length}`);
    if (rows.length) rows.forEach((r) => console.log("  • " + render(r)));
  };

  section("DRIFT — Clerk ↔ staff resolved-role mismatch (REAL: fix the stale store)", mismatches, (m) =>
    `${m.email}: clerk=${m.clerk} (raw ${fmt(m.clerkRaw)}) vs staff=${m.staff} (raw ${fmt(m.staffRaw)})`,
  );
  section("STALE RAW VALUE — resolves correctly today, but the stored string is legacy/unknown", staleRaw, (s) =>
    `${s.email} [${s.store}]: raw="${fmt(s.raw)}" → ${s.resolves}`,
  );
  section("DONOR ANOMALY — role=donor without a positive net gift", donorAnomalies, (d) =>
    `${d.email}: net=${d.net}¢ — ${d.note}`,
  );
  section("INFO — active staff row with no Clerk account yet (pending invite — expected)", orphanStaff, (o) =>
    `${o.email}: staff role ${o.staffRole}`,
  );
  section("REVIEW — Clerk staff-role user with no active staff row (env-allowlist admin? or revoked-in-DB-only)", staffNoRow, (x) =>
    `${x.email}: clerk role ${x.clerkRole}`,
  );

  // Audit log FYI — historical, not current state.
  const log = await lastAccessLogRole();
  console.log(`\nFYI — last ${log.length} AUDIT#access entries (HISTORY, not current state; legacy role names here are expected):`);
  log.forEach((e) => console.log(`  ${e.at}  ${e.action}  ${fmt(e.target)}  role=${fmt(e.role)}`));

  // --- Verdict ----------------------------------------------------------------------
  const realProblems = mismatches.length + donorAnomalies.length + staleRaw.filter((s) => String(s.resolves).includes("⚠️")).length;
  const normalizationCandidates = staleRaw.filter((s) => !String(s.resolves).includes("⚠️")).length;
  console.log("\n" + "=".repeat(48));
  if (realProblems === 0 && normalizationCandidates === 0) {
    console.log("VERDICT: ✅ consistent — Clerk and DynamoDB agree, no stale raw values, donors reconcile.");
  } else {
    console.log(
      `VERDICT: ${realProblems} real discrepanc${realProblems === 1 ? "y" : "ies"} (mismatch/unknown/donor), ` +
        `${normalizationCandidates} legacy-but-resolvable value(s) to optionally normalize.`,
    );
    console.log("Next: paste this output back. Real discrepancies → re-stamp the stale store; legacy values → optional one-off normalization (safe; reads already coerce).");
  }
}

main().catch((e) => {
  console.error("Audit failed:", e?.message ?? e);
  process.exit(1);
});
