import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { SignPlacementTool } from "@/components/dashboard/SignPlacementTool";
import { requireCap, staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dbConfigured } from "@/lib/db";
import { listActiveCaptains } from "@/lib/volunteers/captains";
import { listSignPlacements } from "@/lib/signs/store";
import type { CaptainInput } from "@/lib/signs/placement";

export const dynamic = "force-dynamic";

// The sign-strategy page: the browser front-end for the scorer behind
// candidate/sign-placement-plan.md (§8). Paste the locations CSV → ranked deploy list +
// dropped-with-reasons audit trail + optional per-captain turf packets, all client-side.
// Saved placements persist in DynamoDB with an inline gate-verification workflow.
export default async function SignsPage() {
  await requireCap("viewTargets");
  const g = await staffGate();
  const canManage = can(g.role, "manageSigns");

  // The real, active captain roster (email as id) — loaded server-side so the tool has it
  // immediately, no client fetch needed. Same shape getVolunteers()/listActiveCaptains() already
  // powers on the coverage page. [] on any DB hiccup — never blocks the paste-based workflow.
  const captains = await listActiveCaptains();
  const initialCaptains: CaptainInput[] = captains.map((c) => ({ id: c.email, name: c.name, contact: c.email }));

  // Saved placements — the durable home for verified locations. [] when DB off.
  const initialSaved = await listSignPlacements();

  return (
    <>
      <PageHeader kicker="Field" title="Sign placement" />

      <HowTo
        steps={[
          "Paste your locations CSV (schema in the hint — it's the plan's polling_sites.csv, §7 of candidate/sign-placement-plan.md). Scoring runs in your browser; rows are only uploaded if you click \"Save new locations\".",
          "Keep the hard-gate columns honest: in_district, buffer_verified, and property_permission must be real — a false on any drops the row into the audit table below, never onto a lawn.",
          "Traffic can be the raw MoDOT aadt count (auto-normalized across your paste) or a pre-normalized aadt_norm. Missing factors default to neutral values.",
          "Optionally paste the captains CSV to get per-captain turf packets with inventory and span-of-control flags — or leave the real active-captain roster toggled on to use it as-is.",
          "\"Load live Election-Day polling places\" pulls the county's real MO-02 polling sites in, but they land straight in the dropped/audit table — the feed can't confirm buffer or property permission, so a human still has to verify each one before it counts as deployable.",
          "Sites rank first (early-vote locations are funded off the top), then corridors/residential. Download placement_output.csv when the list looks right.",
          "Click \"Save new locations\" to persist the current rows — they'll be here next session, and the Saved locations table below is where verification happens: flip in-district / buffer / permission per site as you confirm with each election authority, assign a captain, add notes. After saving, edit through that table (a re-pasted duplicate row is ignored).",
          "Scripts can POST the same CSV to /api/dashboard/signs/placement for the identical output.",
        ]}
      />

      {!dbConfigured && <DbNotice />}

      <p className="mb-5 max-w-prose text-sm text-slate">
        The strategy, phases, and the compliance rules that govern every placement live in{" "}
        <span className="font-mono">candidate/sign-placement-plan.md</span> — read its <strong>§9</strong>{" "}
        before placing a single sign (25-ft polling-place buffer, no right-of-way, permission logged,
        per-municipality removal deadlines). This page only ranks; the gates and the law come first.
      </p>

      <SignPlacementTool
        initialCaptains={initialCaptains}
        initialSaved={initialSaved}
        canManage={canManage}
        connected={dbConfigured}
      />
    </>
  );
}
