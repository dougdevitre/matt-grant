import { redirect } from "next/navigation";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { VotersExplorer } from "@/components/dashboard/VotersExplorer";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dbConfigured } from "@/lib/db";
import { listActiveCaptains } from "@/lib/volunteers/captains";
import { listVoterAggs, latestIngestRun } from "@/lib/voters/store";
import { RSMO_NOTICE } from "@/lib/voters/dashboard";

export const dynamic = "force-dynamic";

// The voter command center (candidate/voter-file-plan.md Phase 2). ADMIN-ONLY
// (viewVoterFile): this is RSMo 115.157 data — captains receive generated turf
// packets (Phase 4), never raw access. Reads VOTERAGG rollups; voters load one
// bounded precinct shard at a time.
export default async function VotersPage() {
  const { role } = await staffGate();
  if (!can(role, "viewVoterFile")) redirect("/dashboard?denied=voters");

  const [aggs, run, captains] = await Promise.all([listVoterAggs(), latestIngestRun(), listActiveCaptains()]);
  const ingestedAt = run && typeof run.SK === "string" ? run.SK.slice(0, 10) : null;

  return (
    <>
      <PageHeader kicker="Field" title="Voter database" />

      <p className="mt-2 max-w-3xl rounded-sm border border-brick/30 bg-brick/5 px-4 py-2 text-[0.75rem] leading-relaxed text-ink">
        {RSMO_NOTICE}
      </p>

      <HowTo
        steps={[
          "The scoreboard and precinct table come from per-precinct rollups of the official MO-02 voter file (577,366 registered voters, six counties). T is turnout propensity 0-5 from participation recency; segments follow the targeting matrix in workflows/voter-targeting.md.",
          "Support is a labeled PROXY (party is blank for ~88% of Missouri rows) — BANK/MOBILIZE grow as canvass IDs replace it (Phase 5). PERSUADE is honestly big: habitual voters with unknown lean are the doors-and-mail universe.",
          "Open a precinct to browse its voters (filters: segment, T, age band, street), export RSMo-stamped walk / mail / call lists, and print street-sorted walk packets (~40-60 doors per turf, captain-allocated) with the 1-5 canvass-ID column.",
          "The file carries NO phones. Call lists and call sheets show a phone only when a volunteer/donor record matches by name + ZIP — those numbers are for MANUAL DIAL only; SMS is never sourced from this data.",
          "Handle exports like donor lists: no forwarding, no personal devices, delete when stale (candidate/voter-file-plan.md §2).",
        ]}
      />

      {!dbConfigured && <DbNotice />}

      {aggs.length === 0 ? (
        <div className="mt-6 card p-6">
          <p className="font-display text-lg text-ink">No voter data ingested yet</p>
          <p className="mt-2 max-w-2xl text-sm text-slate">
            The voter engine is wired but the database is empty. From a machine with AWS credentials and the
            five xlsx files (private S3, <span className="font-mono">voters/raw/</span> — see{" "}
            <span className="font-mono">docs/VOTER-FILE.md</span>):
          </p>
          <pre className="mt-3 overflow-x-auto rounded-sm bg-ink/5 p-3 font-mono text-xs text-ink">
            npm run ingest:voters -- --dir /path/to/xlsx --dry-run{"\n"}
            npm run ingest:voters -- --dir /path/to/xlsx
          </pre>
          <p className="mt-2 text-xs text-slate">
            The dry run prints the reconciliation report without writing; the live run loads ~577k rows in a few
            minutes. This page lights up automatically afterward.
          </p>
        </div>
      ) : (
        <>
          {ingestedAt && (
            <p className="mt-2 text-[0.7rem] text-slate">Last ingest: {ingestedAt} (manifest on file with source hashes).</p>
          )}
          <VotersExplorer aggs={aggs} captains={captains.map((c) => ({ id: c.email, name: c.name || c.email }))} />
        </>
      )}
    </>
  );
}
