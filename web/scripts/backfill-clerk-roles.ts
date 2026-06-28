// One-off backfill: stamp the correct RBAC role onto EXISTING Clerk users.
//
// WHY: the user.created webhook (app/api/webhooks/clerk/route.ts) only stamps
// publicMetadata.role on NEW signups. Accounts created before the webhook existed
// have no role, so the dashboard/community gating falls back unpredictably. This
// script reconciles every existing user once, replicating the webhook's exact
// precedence and adding a donor check the webhook can't do at first sign-in.
//
// Precedence (resolveRole in lib/role-backfill.ts — the single, tested source):
//   1. DASHBOARD_ALLOWLIST match → "admin"
//   2. active invited staff row  → that role (admin/captain/volunteer)
//   3. positive net contribution → "donor"
//   4. otherwise                 → "supporter"
//
// Safe by construction:
//   • DRY RUN by default — reports what WOULD change, writes NOTHING. Pass --apply
//     to actually write via setClerkRoleByEmail.
//   • IDEMPOTENT — skips any user whose publicMetadata.role is already set, so a
//     re-run only touches the still-unstamped remainder.
//
// Usage:
//   CLERK_SECRET_KEY=sk_live_... DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 \
//     npm run backfill:roles            # dry run
//   ... npm run backfill:roles -- --apply   # actually write
import { emailAllowed } from "../lib/auth";
import { staffRole } from "../lib/staff";
import { asRole } from "../lib/rbac";
import { resolveRole } from "../lib/role-backfill";
import { donorSummaryForEmail } from "../lib/donorStatus";
import { setClerkRoleByEmail } from "../lib/clerkRoles";

const APPLY = process.argv.includes("--apply");

// Fail with a clear message + non-zero exit rather than throwing a stack trace.
function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

async function main() {
  // Env guards — this script needs Clerk (to read/write users) and, for the staff
  // + donor checks to be meaningful, AWS/DynamoDB. Missing Clerk is fatal; missing
  // AWS is a loud warning (staff/donor steps degrade to null, so users resolve to
  // the supporter floor — almost never what you want for a real backfill).
  if (!process.env.CLERK_SECRET_KEY) {
    die("CLERK_SECRET_KEY is not set. Set it to your Clerk secret (sk_live_… or sk_test_…) and re-run.");
  }
  if (!process.env.DYNAMODB_TABLE) {
    die(
      "DYNAMODB_TABLE is not set. The staff-role and donor checks read DynamoDB; " +
        "without it every user would resolve to \"supporter\". Set DYNAMODB_TABLE + AWS_REGION (and AWS creds) and re-run.",
    );
  }

  console.log(
    `Backfill Clerk roles — ${APPLY ? "APPLY (writing changes)" : "DRY RUN (no writes; pass --apply to write)"}`,
  );
  if (!process.env.DASHBOARD_ALLOWLIST) {
    console.warn(
      "  note: DASHBOARD_ALLOWLIST is unset — no user will be resolved to \"admin\" by allowlist (matches the webhook).",
    );
  }

  const { clerkClient } = await import("@clerk/nextjs/server");
  let client: Awaited<ReturnType<typeof clerkClient>>;
  try {
    client = await clerkClient();
  } catch (e) {
    die(`Could not initialize the Clerk client: ${(e as Error).message}`);
  }

  let total = 0;
  let skipped = 0;
  let noEmail = 0;
  const assigned: Record<string, number> = {};
  const note = (role: string) => {
    assigned[role] = (assigned[role] ?? 0) + 1;
  };

  // Page through every Clerk user. getUserList caps at 100/page; advance by offset
  // until a short page signals the end.
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const { data: users } = await client.users.getUserList({ limit, offset });
    if (!users.length) break;

    for (const user of users) {
      total++;
      const email =
        user.primaryEmailAddress?.emailAddress ??
        user.emailAddresses?.[0]?.emailAddress ??
        null;

      // Idempotency: never touch a user already stamped with a known role.
      const existing = asRole((user.publicMetadata as { role?: unknown } | undefined)?.role);
      if (existing) {
        skipped++;
        continue;
      }

      if (!email) {
        // No usable email → can't resolve allowlist/staff/donor. Leave untouched.
        noEmail++;
        continue;
      }

      // Wire the REAL data sources into the pure resolver, mirroring the webhook.
      const isAdminAllowlisted = emailAllowed(email) && !!process.env.DASHBOARD_ALLOWLIST;
      const staff = await staffRole(email);
      const isDonor = (await donorSummaryForEmail(email)).hasDonated;

      const role = resolveRole({ email, isAdminAllowlisted, staffRole: staff, isDonor });
      note(role);
      console.log(`  ${APPLY ? "set" : "would set"}  ${email} → ${role}`);

      if (APPLY) {
        await setClerkRoleByEmail(email, role);
      }
    }

    if (users.length < limit) break;
  }

  const changed = Object.values(assigned).reduce((a, b) => a + b, 0);
  console.log("\n── Summary ──────────────────────────────────────────");
  console.log(`  total users scanned   : ${total}`);
  console.log(`  skipped (already set) : ${skipped}`);
  if (noEmail) console.log(`  skipped (no email)    : ${noEmail}`);
  console.log(`  ${APPLY ? "stamped" : "would stamp"} : ${changed}`);
  for (const role of Object.keys(assigned).sort()) {
    console.log(`      ${role.padEnd(10)} : ${assigned[role]}`);
  }
  if (!APPLY && changed > 0) {
    console.log("\n  Dry run only — re-run with `-- --apply` to write these changes.");
  }
  console.log("─────────────────────────────────────────────────────");
}

main().catch((e) => {
  console.error("\n✗ Backfill failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
