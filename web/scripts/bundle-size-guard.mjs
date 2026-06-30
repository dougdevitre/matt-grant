// Bundle-size guard. Run AFTER a `BUNDLE_GUARD=1 next build` (standalone output).
//
// Amplify Hosting silently FAILS a deploy when the SSR compute bundle exceeds a hard
// 220 MiB cap (230686720 bytes) — and it only finds out at deploy time, AFTER merge
// (this bit us: PR #234 tipped it, deploys 345/346 failed, fixed via revert #235).
// Next's `standalone` output is server + traced node_modules — the same thing Amplify
// packages into the Lambda — so measuring it in CI catches an over-cap PR BEFORE merge.
//
// `.next/static` is served from the CDN, NOT in the compute Lambda, so it's excluded.
//
// NOTE: needs real (non-symlinked) node_modules to be meaningful — true in CI after
// `npm ci`. In a worktree whose node_modules is a symlink, the tracer copies nothing
// and the measurement is ~0; the guard detects that and skips rather than false-pass.
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

// 220 MiB = the hard Amplify SSR compute cap. Overridable via BUNDLE_CAP_BYTES so the
// threshold can be calibrated in ci.yml (standalone size is a close proxy for Amplify's
// packaging, but not byte-identical) without a code change.
const CAP = Number(process.env.BUNDLE_CAP_BYTES) || 230686720;
const WARN_AT = CAP - 10 * 1048576; // warn with <10 MiB of headroom left
const DIR = ".next/standalone";

async function dirBytes(path) {
  let total = 0;
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const full = join(path, e.name);
    if (e.isDirectory()) total += await dirBytes(full);
    else if (e.isFile()) {
      try {
        total += (await stat(full)).size;
      } catch {
        /* race / broken link — ignore */
      }
    }
  }
  return total;
}

const bytes = await dirBytes(DIR);
const nodeModulesBytes = await dirBytes(join(DIR, "node_modules"));
const mib = (n) => (n / 1048576).toFixed(1);

// The compute bundle is dominated by traced node_modules. If that portion is tiny, the
// trace didn't happen (symlinked node_modules in a worktree, or no BUNDLE_GUARD build)
// and the number is meaningless — skip rather than false-pass. CI (real `npm ci` deps)
// always traces them, so the guard is live there.
if (nodeModulesBytes < 10 * 1048576) {
  console.log(`bundle-size-guard: standalone node_modules only ${mib(nodeModulesBytes)} MiB — deps not traced (symlinked node_modules or missing BUNDLE_GUARD build). Skipping; CI measures on real node_modules.`);
  process.exit(0);
}

const headroom = CAP - bytes;
console.log(`SSR compute bundle (standalone): ${mib(bytes)} MiB / ${mib(CAP)} MiB cap — headroom ${mib(headroom)} MiB`);

if (bytes >= CAP) {
  console.error(`::error::Bundle ${mib(bytes)} MiB EXCEEDS the ${mib(CAP)} MiB Amplify SSR cap — this PR would FAIL the deploy. Trim a heavy server dep or move generation (sharp / @vercel/og / video) off the SSR compute. See project memory: matt-grant deploy bundle cap.`);
  process.exit(1);
}
if (bytes >= WARN_AT) {
  console.log(`::warning::Bundle within ${mib(headroom)} MiB of the cap — headroom is thin. Avoid adding heavy server deps; plan bundle relief.`);
}
console.log("bundle-size-guard: OK");
