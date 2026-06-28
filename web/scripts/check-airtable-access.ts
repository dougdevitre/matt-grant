// Live drift check for the Airtable front-end CRUD governance.
//
// For every governed surface in lib/airtable/governance-manifest.ts, this reads the base's
// "Front-End Access" control table via the workspace PAT and asserts the row exists and its
// Create/Read/Update/Delete checkboxes match what the app was built against. It catches the
// SILENT, fail-closed failures that hermetic tests can't:
//   • a renamed/deleted control row    → feature silently goes read-only/empty
//   • a flipped checkbox                → an enabled op silently stops working (or vice-versa)
//   • a base missing from the PAT allowlist → that base fail-closes entirely
//
// Resilience: no token (keyless build) or a transient network/5xx → WARN + exit 0 (don't block).
// Real drift (missing row, mismatched ops) or an auth/permission error (401/403/404) → exit 1.
//
// Run:  npm run airtable:drift     (env-first AIRTABLE_API_KEY, else SSM /matt-grant/AIRTABLE_API_KEY)
import { GOVERNANCE, type GovernedSurface } from "@/lib/airtable/governance-manifest";
import { AIRTABLE_BASES, type BaseKey } from "@/lib/airtable/registry";
import { getSecret } from "@/lib/ssm";

const API_ROOT = "https://api.airtable.com/v0";
type Cell = boolean | string | { name?: string } | undefined;
type Rec = { id: string; fields: Record<string, Cell> };

const truthy = (v: Cell): boolean => v === true || v === "true";
const sel = (v: Cell): string => (typeof v === "string" ? v : (v as { name?: string })?.name ?? "");
const key = (table: string, audience: string) => `${table.trim().toLowerCase()}|${audience}`;

class AuthError extends Error {}

async function readControlTable(token: string, baseId: string, tableId: string): Promise<Map<string, GovernedSurface>> {
  const out = new Map<string, GovernedSurface>();
  let offset: string | undefined;
  do {
    const url = `${API_ROOT}/${baseId}/${tableId}?pageSize=100${offset ? `&offset=${offset}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new AuthError(`HTTP ${res.status} reading control table ${tableId} in ${baseId} (PAT allowlist or renamed table?)`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`); // transient → caller warns
    const data = (await res.json()) as { records?: Rec[]; offset?: string };
    for (const r of data.records ?? []) {
      const f = r.fields;
      const table = sel(f["Table"]);
      const audience = sel(f["Audience"]);
      if (!table || (audience !== "public" && audience !== "dashboard")) continue;
      out.set(key(table, audience), {
        base: "" as BaseKey, table, audience,
        create: truthy(f["Create"]), read: truthy(f["Read"]), update: truthy(f["Update"]), delete: truthy(f["Delete"]),
        surface: "ui",
      });
    }
    offset = data.offset;
  } while (offset);
  return out;
}

async function main() {
  const token = process.env.AIRTABLE_API_KEY || (await getSecret("AIRTABLE_API_KEY"));
  if (!token) {
    console.log("⏭️  airtable:drift skipped — no AIRTABLE_API_KEY (keyless build).");
    process.exit(0);
  }

  const fails: string[] = [];
  const warns: string[] = [];
  const bases = [...new Set(GOVERNANCE.map((g) => g.base))];

  for (const base of bases) {
    const cfg = AIRTABLE_BASES[base] as { id: string; accessTable?: string };
    if (!cfg?.accessTable) { fails.push(`${base}: no accessTable in registry`); continue; }
    let rows: Map<string, GovernedSurface>;
    try {
      rows = await readControlTable(token, cfg.id, cfg.accessTable);
    } catch (e) {
      if (e instanceof AuthError) { fails.push(`${base}: ${e.message}`); }
      else { warns.push(`${base}: transient read error (${e instanceof Error ? e.message : e}) — skipped`); }
      continue;
    }
    for (const g of GOVERNANCE.filter((x) => x.base === base)) {
      const got = rows.get(key(g.table, g.audience));
      if (!got) { fails.push(`${base} » "${g.table}" [${g.audience}]: control row MISSING`); continue; }
      for (const op of ["create", "read", "update", "delete"] as const) {
        if (got[op] !== g[op]) {
          fails.push(`${base} » "${g.table}" [${g.audience}]: ${op} is ${got[op]} in Airtable, expected ${g[op]}`);
        }
      }
    }
  }

  for (const w of warns) console.warn(`⚠️  ${w}`);
  if (fails.length) {
    console.error(`\n❌ Airtable governance drift (${fails.length}):`);
    for (const f of fails) console.error(`   • ${f}`);
    process.exit(1);
  }
  console.log(`✅ Airtable governance in sync — ${GOVERNANCE.length} surfaces across ${bases.length} bases match the manifest.${warns.length ? ` (${warns.length} base(s) skipped)` : ""}`);
}

main().catch((e) => { console.error("airtable:drift crashed:", e); process.exit(1); });
