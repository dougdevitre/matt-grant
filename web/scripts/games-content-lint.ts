// Content lint for the Four Fights arcade. Validates every content/games/*.json
// against its zod schema AND the tone guardrail (no named persons) baked into
// GameContentSchema. Run with `npm run games:content-lint`; wire into CI next to
// `npm run compliance` so off-message or malformed copy can't ship.
//
// Editors tune copy/balance in the JSON only — this gate keeps those edits safe
// without a logic deploy.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { GameContentSchema } from "../lib/games/content-schema";
import { CutSaveConfigSchema } from "../lib/games/cut-and-save/config.schema";

const DIR = path.join(process.cwd(), "content", "games");

// Per-game mechanics-config schemas. Copy is validated for every game; config is
// validated when a schema exists for that game id.
const CONFIG_SCHEMAS: Record<string, { parse: (v: unknown) => unknown }> = {
  "cut-and-save": CutSaveConfigSchema,
};

const fails: string[] = [];

let files: string[] = [];
try {
  files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
} catch {
  console.error(`❌ games:content-lint — no content directory at ${DIR}`);
  process.exit(1);
}

if (files.length === 0) fails.push("no content/games/*.json files found");

for (const file of files) {
  const full = path.join(DIR, file);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(full, "utf8"));
  } catch (e) {
    fails.push(`${file}: invalid JSON (${(e as Error).message})`);
    continue;
  }
  const obj = json as { copy?: unknown; config?: unknown };

  const copy = GameContentSchema.safeParse(obj.copy);
  if (!copy.success) {
    for (const issue of copy.error.issues) fails.push(`${file} copy.${issue.path.join(".")}: ${issue.message}`);
    continue;
  }

  const schema = CONFIG_SCHEMAS[copy.data.gameId];
  if (schema) {
    try {
      schema.parse(obj.config);
    } catch (e) {
      fails.push(`${file} config: ${(e as Error).message}`);
    }
  }
}

if (fails.length) {
  console.error(`\n❌ games:content-lint FAILED (${fails.length}):`);
  for (const f of fails) console.error(`   • ${f}`);
  process.exit(1);
}
console.log(`✅ games:content-lint passed (${files.length} file${files.length === 1 ? "" : "s"}).`);
