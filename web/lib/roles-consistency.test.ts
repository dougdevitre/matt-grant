import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROLES, STAFF_ROLES } from "./rbac";

// Static guards that lock in the role de-drift across the FRONT-END and BACK-END
// source (a complement to the in-memory invariants in rbac.test.ts). These read the
// actual files on disk, so they fail the build if anyone re-introduces a hardcoded
// legacy role name or lets the audit script's mirrored role list drift from rbac.ts.
//
// What is deliberately NOT enforced here: a blanket "no role === string anywhere"
// rule. A handful of legitimate IDENTITY branches remain (admin-only preview gating
// in auth.ts/view-as.ts, the partner/supporter wall in community/team pages, the
// donor home in homeFor). Those are tier identity, not capability checks — banning
// them would force noise-suppression. Capability gating is covered by `can()`; label
// and badge centralization is covered by the rbac.test.ts invariants.

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));

function sourceFiles(dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".next") continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
        out.push(p);
      }
    }
  };
  for (const d of dirs) walk(join(WEB_ROOT, d));
  return out;
}

// Drop block + line comments so prose mentions of "member"/"organizer" (which several
// files legitimately have, e.g. "legacy 'organizer' rows") don't trip the guard.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("role consistency — static guards", () => {
  const files = sourceFiles(["app", "components", "lib"]);

  it("finds source files to scan (guard is actually running)", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("legacy role names ('member'/'organizer') as string literals live ONLY in rbac.ts", () => {
    // The rename member→volunteer kept zero-migration back-compat via the alias map in
    // rbac.ts. No other FE/BE code should branch on the old names — if it does, the
    // rename is incomplete and behavior can drift from the canonical model.
    const legacyLiteral = /['"](member|organizer)['"]/;
    const offenders: string[] = [];
    for (const f of files) {
      if (f.endsWith(`${join("lib", "rbac.ts")}`)) continue; // the one allowed home (alias map)
      const code = stripComments(readFileSync(f, "utf8"));
      if (legacyLiteral.test(code)) {
        const line = code.split("\n").findIndex((l) => legacyLiteral.test(l)) + 1;
        offenders.push(`${f.replace(WEB_ROOT, "")}:${line}`);
      }
    }
    expect(offenders, `legacy role literal outside rbac.ts:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the maintenance scripts' mirrored role lists stay in sync with rbac.ts", () => {
    // The scripts/*.mjs are plain node ESM and re-declare ROLES/STAFF_ROLES (they
    // cannot import the TS source). This guard makes those mirrors authoritative:
    // change a role in rbac.ts and every script must follow, or the build fails.
    const SCRIPTS = ["audit-roles.mjs", "staff-list.mjs", "normalize-roles.mjs"];
    const parseArray = (script: string, name: string): string[] => {
      const m = script.match(new RegExp(`const ${name} = (\\[[^\\]]*\\])`));
      if (!m) throw new Error(`could not find 'const ${name} = [...]'`);
      return (JSON.parse(m[1].replace(/'/g, '"')) as string[]).map(String);
    };
    for (const file of SCRIPTS) {
      const src = readFileSync(join(WEB_ROOT, "scripts", file), "utf8");
      expect(parseArray(src, "ROLES"), `${file} ROLES`).toEqual([...ROLES]);
      // STAFF_ROLES only where the script declares it (audit-roles uses it).
      if (/const STAFF_ROLES = /.test(src)) {
        expect(parseArray(src, "STAFF_ROLES"), `${file} STAFF_ROLES`).toEqual([...STAFF_ROLES]);
      }
    }
  });
});
