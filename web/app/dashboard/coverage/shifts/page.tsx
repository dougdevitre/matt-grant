import { redirect } from "next/navigation";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { ShiftBoard, type AssigneeOption } from "@/components/dashboard/ShiftBoard";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dbConfigured } from "@/lib/db";
import { getVolunteers } from "@/lib/queries";
import { listActiveCaptains } from "@/lib/volunteers/captains";
import { listShifts } from "@/lib/coverage/shiftStore";
import { listSignPlacements } from "@/lib/signs/store";

export const dynamic = "force-dynamic";

// The poll-coverage shift board: the tooling behind candidate/poll-coverage-plan.md
// §4–§5. Generate the early-vote + Election-Day schedule (site × day × window),
// assign greeters per shift, watch the §8 fill metrics, and print per-person shift
// packets with the §7 conduct rules. Gated manageTeam, like the coverage map beside it.
export default async function PollShiftsPage() {
  const { role } = await staffGate();
  if (!can(role, "manageTeam")) redirect("/dashboard?denied=coverage");

  const [shifts, captains, vols, savedSigns] = await Promise.all([
    listShifts(),
    listActiveCaptains(),
    getVolunteers(),
    listSignPlacements(),
  ]);

  // Assignee picker: captains (by email) + the volunteer roster, with the coarse
  // availability buckets as a hint. Deduped by id; captains listed first.
  const seen = new Set<string>();
  const assigneeOptions: AssigneeOption[] = [];
  for (const c of captains) {
    if (seen.has(c.email)) continue;
    seen.add(c.email);
    assigneeOptions.push({ id: c.email, name: c.name || c.firstName, hint: "captain" });
  }
  for (const v of vols.rows) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    assigneeOptions.push({ id: v.id, name: v.name, hint: v.availability.join(" / ") || undefined });
  }

  // Pre-fill the generator with the saved early-vote/site locations from the Signs
  // tool (type "site") — signs and people land at the same high-value places (§4).
  const prefillSites = [...new Set(savedSigns.filter((s) => s.type === "site").map((s) => s.name))].join("\n");

  return (
    <>
      <PageHeader kicker="Field" title="Poll shifts" />

      <HowTo
        steps={[
          "Generate the schedule: paste the confirmed early-vote sites (they pre-fill from the Signs tool's saved site locations once those are saved), pick the date range, and adjust the window labels if a site's real hours differ — actual hours come from each election authority, not from this page.",
          "Assign a greeter to each window from the roster (captains first, then volunteers with their availability as a hint). A shift shows covered only when it has as many people as it needs — an unstaffed site stays honestly uncovered (plan §4).",
          "Use \"need\" to raise a busy site's headcount, and notes for site quirks (posted buffer line, parking, entrance).",
          "Print shift packets: one page per greeter with their full schedule plus the §7 conduct rules (25-ft buffer, greeting ≠ poll watching, report-don't-confront), and an unfilled-shifts page for recruiting.",
          "Volunteers can also take open shifts themselves on the supporter hub (/community) — self-signups appear here instantly, and \"Can't make it\" drops free the slot again.",
          "The strategy, phases, and the compliance rules live in candidate/poll-coverage-plan.md — every greeter reads §7 before their first shift.",
        ]}
      />

      {!dbConfigured && <DbNotice />}

      <ShiftBoard
        initialShifts={shifts}
        assigneeOptions={assigneeOptions}
        prefillSites={prefillSites}
        connected={dbConfigured}
      />
    </>
  );
}
