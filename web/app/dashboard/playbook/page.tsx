import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listStaff } from "@/lib/staff";
import { listRegions } from "@/lib/volunteers/regions";
import {
  buildPlaybook,
  CADENCE_LABEL,
  MODE_LABEL,
  type Play,
} from "@/lib/volunteers/playbook";

export const dynamic = "force-dynamic";

const cadenceCls: Record<string, string> = {
  weekly: "bg-brick/10 text-brick",
  biweekly: "bg-gold/15 text-ink",
  monthly: "bg-ink/5 text-slate",
  "as-needed": "bg-ink/5 text-slate",
};

function PlayCard({ play }: { play: Play }) {
  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${cadenceCls[play.cadence] ?? "bg-ink/5 text-slate"}`}>
          {CADENCE_LABEL[play.cadence]}
        </span>
        <span className="rounded-sm bg-field/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-field">
          {MODE_LABEL[play.mode]}
        </span>
      </div>
      <p className="mt-2 font-display text-base text-ink">{play.title}</p>
      <p className="mt-1 text-sm text-slate">{play.how}</p>
      <Link href={play.href} className="mt-2 inline-block text-xs font-semibold text-brick underline">
        {play.where} →
      </Link>
    </li>
  );
}

function PlayList({ plays }: { plays: Play[] }) {
  return <ul className="mt-3 grid gap-3 sm:grid-cols-2">{plays.map((p) => <PlayCard key={p.id} play={p} />)}</ul>;
}

export default async function PlaybookPage() {
  const { role, email } = await staffGate();
  if (!can(role, "manageVolunteers")) redirect("/dashboard?denied=playbook");

  // The viewer's own assigned regions (a captain's staff row). Admins previewing
  // and unassigned captains have none — they see the region plays as a template.
  const [staff, regions] = await Promise.all([listStaff(), listRegions()]);
  const me = email ? staff.find((s) => s.email.toLowerCase() === email.toLowerCase()) : undefined;
  const myRegionNames = new Set((me?.regions ?? []).map((r) => r.trim().toLowerCase()));
  const myRegions = regions.filter((r) => myRegionNames.has(r.name.trim().toLowerCase()));

  const pb = buildPlaybook(myRegions);

  return (
    <>
      <PageHeader kicker="Field" title="Captain playbook" />
      <HowTo
        steps={[
          "These are the plays you run as a captain — what to do, how often, and whether it's online, in person, or both. Every play links to where you do it in the dashboard.",
          "Team plays apply to your whole team. Region plays repeat in each area you're assigned — assigned by an admin on the Team page and shown on the Coverage map.",
          "Cadence is a rhythm, not a deadline: keep the weekly plays weekly and the rest will follow.",
        ]}
      />

      <section className="mt-6">
        <p className="eyebrow text-slate">Every week — your whole team</p>
        <PlayList plays={pb.team} />
      </section>

      {pb.hasRegions ? (
        pb.byRegion.map(({ region, plays }) => (
          <section key={`${region.level}:${region.name}`} className="mt-8">
            <p className="eyebrow text-slate">
              In {region.name}
              <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">{region.level}</span>
            </p>
            <PlayList plays={plays} />
          </section>
        ))
      ) : (
        <section className="mt-8">
          <p className="eyebrow text-slate">In each of your regions</p>
          <p className="mt-1 max-w-2xl text-sm text-slate">
            You don&rsquo;t have a region assigned yet, so these are shown as a template. Once an admin assigns you a
            region on the{" "}
            <Link href="/dashboard/team" className="text-brick underline">Team page</Link>, these plays repeat for each
            one and your volunteers auto-match to you by area.
          </p>
          <PlayList plays={pb.regionPlays} />
        </section>
      )}
    </>
  );
}
