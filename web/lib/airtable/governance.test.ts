import { describe, it, expect } from "vitest";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";
import { GOVERNANCE } from "@/lib/airtable/governance-manifest";
import { ALL_SPEC_TABLES } from "@/lib/volunteer/reference-specs";

// Wiring-parity: prove the code's view of the governed Airtable surfaces is internally consistent
// and resolves against the registry. The LIVE drift script (scripts/check-airtable-access.mjs)
// then proves Airtable itself matches this manifest. Together they close the silent fail-closed gap.

// The known-real table ids (from the Airtable schema). Locks the registry against a typo that
// would silently point a feature at the wrong / a nonexistent table.
const EXPECTED_IDS: Record<string, Record<string, string>> = {
  masterDb: { _base: "apptae7sUEwqFO2tX", _access: "tblcgIpv6EJgfuR1Y", influentialVoters: "tblBcd7uz3WLHzce2" },
  issues: { _base: "appbfBEbX8XH3bv4w", _access: "tblqV5hSjBdJRtpSS", submissions: "tbl63kV5OGFj5bD6c" },
  socialMedia: {
    _base: "appwrqSIsxaZ9Ltun", _access: "tblFaPlkj2lIhDazN",
    posts: "tblfhW3BnIQ1ri1WD", channels: "tblKcDAyFQ75WG831", contentPillars: "tblnRc1ES8AWGMA00",
    campaigns: "tblzasRpW87WVsuy3", assets: "tblzA08VUScVF034R", startHere: "tbl7NkBg11Ukoakd6",
  },
  volunteer: {
    _base: "appAmtan3qWZE7iGR", _access: "tblAfRmVuSEayP3Iy",
    events: "tblujaq4mmzZdfR3s", contactLists: "tblODeXZVb36giy0x", taskTemplates: "tblbPnBB2pv38kIC4",
    canvassTurf: "tblDOqUtnCkHVkI1U", roles: "tbl3JQ5qSEKRKEZbx", skills: "tbl8X1KtyD2NmTp3s",
    commitmentLevels: "tblCwHWNyFkCbtmEr", geoHierarchy: "tblx9lPk1LjEtScx5",
  },
};

describe("registry ↔ Airtable ids", () => {
  it("matches the known-real base/table/access ids", () => {
    for (const [key, ids] of Object.entries(EXPECTED_IDS)) {
      const base = AIRTABLE_BASES[key as keyof typeof AIRTABLE_BASES] as { id: string; accessTable?: string; tables: Record<string, string> };
      expect(base, `registry missing base ${key}`).toBeTruthy();
      expect(base.id).toBe(ids._base);
      expect(base.accessTable, `${key} needs an accessTable`).toBe(ids._access);
      for (const [t, id] of Object.entries(ids)) {
        if (t.startsWith("_")) continue;
        expect(base.tables[t], `${key}.${t}`).toBe(id);
      }
    }
  });

  it("every base has a control table (no fail-open base)", () => {
    for (const [key, base] of Object.entries(AIRTABLE_BASES)) {
      expect((base as { accessTable?: string }).accessTable, `${key} missing accessTable`).toBeTruthy();
    }
  });
});

describe("governance manifest", () => {
  it("references only real bases that have a control table", () => {
    for (const g of GOVERNANCE) {
      const base = AIRTABLE_BASES[g.base];
      expect(base, `unknown base ${g.base}`).toBeTruthy();
      expect((base as { accessTable?: string }).accessTable).toBeTruthy();
    }
  });

  it("has no duplicate table × audience entries", () => {
    const seen = new Set<string>();
    for (const g of GOVERNANCE) {
      const k = `${g.base}|${g.table.toLowerCase()}|${g.audience}`;
      expect(seen.has(k), `duplicate ${k}`).toBe(false);
      seen.add(k);
    }
  });

  it("uses valid audiences and self-consistent surface semantics", () => {
    for (const g of GOVERNANCE) {
      expect(["public", "dashboard"]).toContain(g.audience);
      if (g.surface === "ui") {
        expect(g.read, `${g.table} ui needs read`).toBe(true);
        expect(g.create || g.update || g.delete, `${g.table} ui needs a write op`).toBe(true);
      }
      if (g.surface === "excluded") {
        expect([g.create, g.read, g.update, g.delete].some(Boolean), `${g.table} excluded must be all-off`).toBe(false);
      }
    }
  });
});

describe("generic-editor specs", () => {
  it("each spec resolves to a registry table and is internally consistent", () => {
    for (const spec of ALL_SPEC_TABLES) {
      const base = AIRTABLE_BASES[spec.base] as { tables: Record<string, string> };
      expect(Object.values(base.tables), `${spec.tableName} tableId not in registry`).toContain(spec.tableId);
      expect(spec.tableName.length).toBeGreaterThan(0);
      const keys = spec.fields.map((f) => f.key);
      expect(new Set(keys).size, `${spec.tableName} has duplicate field keys`).toBe(keys.length);
      expect(spec.fields[0].type, `${spec.tableName} title must be text`).toBe("text");
    }
  });

  it("every spec table is a full-CRUD ui surface in the manifest", () => {
    for (const spec of ALL_SPEC_TABLES) {
      const g = GOVERNANCE.find((x) => x.base === spec.base && x.table === spec.tableName && x.audience === "dashboard");
      expect(g, `manifest missing ${spec.tableName}`).toBeTruthy();
      expect(g!.surface).toBe("ui");
      expect([g!.create, g!.read, g!.update, g!.delete]).toEqual([true, true, true, true]);
    }
  });
});
