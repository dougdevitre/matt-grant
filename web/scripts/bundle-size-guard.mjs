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

// CALIBRATION (2026-06-30): Next `standalone` size is NOT the same scale as Amplify's
// packaged compute bundle — it runs ~60 MiB LIGHTER. Measured: main = 158.4 MiB
// standalone, while Amplify's measure of that same main sits right at its 220 MiB
// (230686720 B) cap (the +9.5 MiB #234 probe tipped Amplify to 229.5 MiB → FAILED).
// So the meaningful threshold is on the STANDALONE scale: Amplify fails at ~standalone
// 160 MiB. We set the budget at 166 MiB — a backstop that catches a probe-class
// regression (+~8 MiB) without false-failing normal PRs (~10 MiB room above main). It
// deliberately does NOT police the last few MiB (would false-fail legit PRs pre-primary,
// worse than a miss — deploy-alert.yml still catches anything that slips, post-merge).
// Real fix for durable headroom = bundle relief (media off the SSR compute), not this.
// Override via BUNDLE_CAP_BYTES if recalibrated.
const CAP = Number(process.env.BUNDLE_CAP_BYTES) || 174063616; // 166 MiB (standalone scale)
const WARN_AT = CAP - 12 * 1048576; // ~154 MiB — main (158) sits in this band: headroom IS thin
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
console.log(`SSR compute bundle (standalone): ${mib(bytes)} MiB / ${mib(CAP)} MiB budget — headroom ${mib(headroom)} MiB`);
console.log(`(standalone runs ~60 MiB under Amplify's packaged size; this budget ≈ the 220 MiB Amplify compute cap)`);

if (bytes >= CAP) {
  console.error(`::error::SSR bundle ${mib(bytes)} MiB exceeds the ${mib(CAP)} MiB standalone budget — a regression this size would tip the Amplify 220 MiB compute cap and FAIL the deploy. Trim a heavy server dep or move generation (sharp / @vercel/og / video) off the SSR compute. See project memory: matt-grant deploy bundle cap.`);
  process.exit(1);
}
if (bytes >= WARN_AT) {
  console.log(`::warning::SSR bundle headroom is thin (${mib(headroom)} MiB) — the app is near the Amplify compute cap. Avoid adding heavy server deps; plan bundle relief (media off the SSR compute).`);
}
console.log("bundle-size-guard: OK");
