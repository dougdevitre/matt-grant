import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { SignPlacementTool } from "@/components/dashboard/SignPlacementTool";
import { requireCap } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The sign-strategy page: the browser front-end for the scorer behind
// candidate/sign-placement-plan.md (§8). Paste the locations CSV → ranked deploy list +
// dropped-with-reasons audit trail + optional per-captain turf packets, all client-side.
export default async function SignsPage() {
  await requireCap("viewTargets");

  return (
    <>
      <PageHeader kicker="Field" title="Sign placement" />

      <HowTo
        steps={[
          "Paste your locations CSV (schema in the hint — it's the plan's polling_sites.csv, §7 of candidate/sign-placement-plan.md). Scoring runs in your browser; nothing is uploaded.",
          "Keep the hard-gate columns honest: in_district, buffer_verified, and property_permission must be real — a false on any drops the row into the audit table below, never onto a lawn.",
          "Traffic can be the raw MoDOT aadt count (auto-normalized across your paste) or a pre-normalized aadt_norm. Missing factors default to neutral values.",
          "Optionally paste the captains CSV to get per-captain turf packets with inventory and span-of-control flags.",
          "Sites rank first (early-vote locations are funded off the top), then corridors/residential. Download placement_output.csv when the list looks right.",
          "Scripts can POST the same CSV to /api/dashboard/signs/placement for the identical output.",
        ]}
      />

      <p className="mb-5 max-w-prose text-sm text-slate">
        The strategy, phases, and the compliance rules that govern every placement live in{" "}
        <span className="font-mono">candidate/sign-placement-plan.md</span> — read its <strong>§9</strong>{" "}
        before placing a single sign (25-ft polling-place buffer, no right-of-way, permission logged,
        per-municipality removal deadlines). This page only ranks; the gates and the law come first.
      </p>

      <SignPlacementTool />
    </>
  );
}
