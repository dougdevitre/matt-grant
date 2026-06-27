// Guards the one date the dynamic nav depends on. CAMPAIGN.electionDate drives
// the countdown and the GOTV CTA ("Plan your vote"); if it silently lapses after
// the primary (and isn't bumped to the next election, e.g. the November general),
// the countdown vanishes and the GOTV CTA never fires again. Run on a schedule
// (.github/workflows/election-date-check.yml) so a lapse is caught and surfaced,
// not discovered live. Reads the constant directly so it can't drift.

import { readFileSync } from "node:fs";
import path from "node:path";

const src = readFileSync(path.join(process.cwd(), "lib", "site.ts"), "utf8");
const match = src.match(/electionDate:\s*"([^"]+)"/);
if (!match) {
  console.error("::error::Could not find CAMPAIGN.electionDate in lib/site.ts");
  process.exit(1);
}

const iso = match[1];
const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

if (days < 0) {
  console.error(
    `::error::CAMPAIGN.electionDate (${iso}) is ${-days} day(s) PAST. Update it for the next election ` +
      `(e.g. the November general) — the countdown and the GOTV "Plan your vote" CTA depend on it.`,
  );
  process.exit(1);
}

if (days <= 21) {
  console.log(`::warning::Election in ${days} day(s) — the GOTV CTA is live. After it passes, bump CAMPAIGN.electionDate.`);
}

console.log(`Election date OK: ${iso} is ${days} day(s) out.`);
