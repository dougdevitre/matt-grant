// Read-only Clerk inventory — closes drift item D7 (roles-and-permissions.md).
//
// The app keys RBAC off Clerk `publicMetadata.role`, NOT Clerk's native
// Organization Roles & Permissions. This script reports BOTH so you can see
// whether anything configured in the Clerk dashboard drifts from the app's roles.
//
// It only READS (lists orgs/roles/permissions + tallies publicMetadata.role across
// users). It never writes. Run it locally with your Clerk secret:
//
//   CLERK_SECRET_KEY=sk_live_... node web/scripts/list-clerk-roles.mjs
//
// Then paste the output back and I'll reconcile it into roles-and-permissions.md.

const key = process.env.CLERK_SECRET_KEY;
if (!key) {
  console.error("Set CLERK_SECRET_KEY=sk_... and re-run.");
  process.exit(1);
}

const API = "https://api.clerk.com/v1";
const h = { authorization: `Bearer ${key}`, "content-type": "application/json" };
const get = async (path) => {
  const r = await fetch(`${API}${path}`, { headers: h });
  if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text().catch(() => "")}`);
  return r.json();
};

const APP_ROLES = ["admin", "captain", "volunteer", "donor", "supporter", "partner"];

async function main() {
  console.log("=== App RBAC roles (the source of truth in web/lib/rbac.ts) ===");
  console.log(APP_ROLES.join(", "));

  // 1) Clerk NATIVE Organization roles & permissions (the dashboard "Roles" tab).
  //    Empty/instance-default ⇒ the app ignores them entirely (no drift to fix).
  console.log("\n=== Clerk native Organization roles & permissions ===");
  try {
    const roles = await get("/organizations/roles?limit=100").catch(() => null);
    const perms = await get("/organizations/permissions?limit=100").catch(() => null);
    const roleList = roles?.data ?? roles ?? [];
    const permList = perms?.data ?? perms ?? [];
    if (!roleList.length) {
      console.log("(none beyond Clerk defaults — the app does not use org roles)");
    } else {
      for (const r of roleList) console.log(`role: ${r.key ?? r.name}  (${r.name ?? ""})`);
    }
    if (permList.length) for (const p of permList) console.log(`perm: ${p.key ?? p.name}`);
  } catch (e) {
    console.log(`(could not read org roles — Organizations may be disabled: ${e.message})`);
  }

  // 2) The roles the app actually enforces: a tally of publicMetadata.role.
  console.log("\n=== publicMetadata.role tally across users (what the app enforces) ===");
  const tally = {};
  let offset = 0;
  for (;;) {
    const users = await get(`/users?limit=100&offset=${offset}`);
    const list = users?.data ?? users ?? [];
    if (!list.length) break;
    for (const u of list) {
      const role = u.public_metadata?.role ?? "(unset)";
      tally[role] = (tally[role] ?? 0) + 1;
    }
    offset += list.length;
    if (list.length < 100) break;
  }
  for (const [role, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    const known = APP_ROLES.includes(role) || role === "member" || role === "organizer" || role === "(unset)";
    console.log(`${role}: ${n}${known ? "" : "   ⚠️  NOT a known app role / alias — drift"}`);
  }
  console.log("\nLegend: 'member'/'organizer' are accepted legacy aliases → volunteer.");
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
