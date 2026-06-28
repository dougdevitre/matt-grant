import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { IssueModeration } from "@/components/dashboard/IssueModeration";
import { requireCap } from "@/lib/auth";
import { airtableConfigured } from "@/lib/airtable/client";
import { can } from "@/lib/airtable/access";
import { listSubmissionsForModeration } from "@/lib/issue-board/airtable";

export const dynamic = "force-dynamic";

export default async function IssueModerationPage() {
  await requireCap("moderateIssues");

  const configured = await airtableConfigured();
  // The Airtable control table is the source of truth for whether the dashboard may read these.
  const readEnabled = configured && (await can("issues", "Submissions", "dashboard", "read"));
  const rows = readEnabled ? await listSubmissionsForModeration() : [];

  return (
    <>
      <PageHeader kicker="Field plan" title="Issue board" />

      <HowTo
        steps={[
          "Supporters submit topics on the public /issues page — they arrive here as Pending.",
          "Approve to publish a topic on the public board, or Reject to hide it.",
          "Edit tidies the public-facing Topic/Details before approving (submitter info stays private).",
          "Delete removes spam permanently.",
          "What this page is allowed to do is governed by the Front-End Access table in the Issues base — flip a checkbox there to enable/disable an action, no deploy.",
        ]}
      />

      <p className="mb-5 max-w-prose text-sm text-slate">
        Moderation queue for the public issue board. Submitter name, city, email, and phone are shown to
        staff here only and never published. Sourced live from the campaign&apos;s Airtable{" "}
        <span className="font-mono">Submissions</span> table in the Issues base.
      </p>

      {!configured ? (
        <div className="card p-8 text-center text-slate">
          Airtable isn&apos;t connected yet. Set <span className="font-mono">AIRTABLE_API_KEY</span> (a token
          with access to the Issues base) to load the moderation queue.
        </div>
      ) : !readEnabled ? (
        <div className="card p-8 text-center text-slate">
          Dashboard read is turned off for <span className="font-mono">Submissions</span> in the Issues base&apos;s{" "}
          <span className="font-mono">Front-End Access</span> table. Check the <strong>Read</strong> box on the
          <span className="font-mono"> Submissions · dashboard</span> row to enable this view.
        </div>
      ) : (
        <IssueModeration rows={rows} />
      )}
    </>
  );
}
