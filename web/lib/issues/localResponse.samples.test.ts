// Dev-only sample generator for Layer-B review. SKIPS in CI (no keys); runs the
// REAL engine end-to-end when ANTHROPIC_API_KEY (+ CENSUS_API_KEY) are injected:
//   ANTHROPIC_API_KEY=... CENSUS_API_KEY=... npx vitest run lib/issues/localResponse.samples.test.ts
// It prints, per issue × ZIP, whether the output is AI or fell back to curated, and
// the paragraphs — the artifact for campaign + counsel sign-off. It ASSERTS nothing
// about content (that's the guards' job); it exists to surface real outputs.
import { describe, it } from "vitest";
import { generateLocalResponse } from "./localResponse";
import { buildLocalSnapshot } from "./localSnapshot";

const RUN = !!process.env.ANTHROPIC_API_KEY;

describe.skipIf(!RUN)("Layer-B sample generation (dev-only)", () => {
  it("generates across the four issues × sample MO-02 ZIPs", async () => {
    const zips = ["63131", "63010", "65066"]; // St. Louis Co, Jefferson (Arnold), Gasconade (rural)
    const issues = ["family-courts", "lower-taxes", "smaller-government", "term-limits"];
    const key = process.env.ANTHROPIC_API_KEY;
    const lines: string[] = [];
    for (const issueSlug of issues) {
      for (const zip of zips) {
        const snapshot = await buildLocalSnapshot(issueSlug, zip);
        const r = await generateLocalResponse(issueSlug, snapshot, { key });
        lines.push(`\n### ${issueSlug} · ${zip}  [${r.source}${snapshot ? "" : ", no-snapshot"}]`);
        for (const p of r.paragraphs) lines.push(`- ${p}`);
      }
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
  }, 180_000);
});
