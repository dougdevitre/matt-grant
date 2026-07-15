import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// TCPA / RSMo §115.157 isolation guard (candidate/voter-file-plan.md §2.3 and
// the "Voter-record usage & lineage" section). The absolute rule: NO number
// derived from, appended to, or matched against the MO-02 voter file may ever be
// broadcast-texted. The SMS pipeline texts ONLY numbers with an explicit opt-in
// in the consent ledger (lib/sms/consent.ts); voter-file-matched phones are
// manual-dial CALL sheets only (lib/voters/phones.ts). This test turns that
// convention into a regression guard: if anyone ever wires a voter-file source
// into the SMS recipient path, the build fails here.

const SMS_DIR = join(dirname(fileURLToPath(import.meta.url)));

// Voter-file surfaces the SMS pipeline must never touch — the partition-key
// builders (lib/db.ts) and the voter modules that read/append phones.
const FORBIDDEN = [
  "@/lib/voters/", // any voter module import
  "lib/voters/phones", // the name+ZIP voter→phone matcher (call sheets only)
  "voterPhones",
  "VOTERPHONE", // vendor phone-append partition
  "voterShard",
  "VOTER#",
  "voterIdx",
  "VOTERIDX",
  "voterAgg",
  "VOTERAGG",
  "ballotReturns",
  "BALLOTRETURN",
];

/** Every non-test .ts source file under lib/sms/, recursively. */
function smsSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...smsSourceFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("SMS pipeline is isolated from the voter file (TCPA)", () => {
  const files = smsSourceFiles(SMS_DIR);

  it("scans a non-empty set of SMS source files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN)("no SMS module references voter-file surface %s", (token) => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes(token));
    expect(
      offenders,
      `A voter-file reference (${token}) leaked into the SMS pipeline — TCPA forbids texting ` +
        `voter-file-derived numbers. Offending files:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("gates broadcast texting on the consent ledger, not any voter source", () => {
    const consent = readFileSync(join(SMS_DIR, "consent.ts"), "utf8");
    // The one and only gate: the SMSCONSENT partition.
    expect(consent).toContain('"SMSCONSENT"');
  });
});
