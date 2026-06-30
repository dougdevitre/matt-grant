import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { Scorecard } from "@/components/dashboard/Scorecard";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { gatherCaptainScorecards } from "@/lib/volunteers/score-data";
import { earnedBadges } from "@/lib/volunteers/badges";

export const dynamic = "force-dynamic";

const HOW_TO = [
  "Your score rewards quality of organizing, not headcount: an engaged, right-sized, active team scores higher than a long list of names.",
  "Five parts: volunteers engaged (welcomed/contacted), volunteers active, team size (a healthy 5–10), a recent in-person event, and an assigned region.",
  "Opted-out volunteers never count toward your engagement — the score never asks you to contact someone who said no.",
  "The Next best action points at the one move that lifts your score the most right now.",
];

export default async function ScorecardPage() {
  const { role, email } = await staffGate();
  if (!can(role, "manageVolunteers")) redirect("/dashboard?denied=scorecard");

  // Admins (manageTeam) see every captain, ranked; a captain sees their own card.
  const isAdmin = can(role, "manageTeam");

  if (isAdmin) {
    const cards = await gatherCaptainScorecards();
    return (
      <>
        <PageHeader kicker="Field" title="Captain scorecards" />
        <HowTo steps={HOW_TO} />
        {cards.length === 0 ? (
          <div className="mt-6 card p-6">
            <p className="font-display text-lg text-ink">No captains to score yet</p>
            <p className="mt-2 max-w-2xl text-sm text-slate">
              Promote a volunteer to captain and assign them a region on the{" "}
              <Link href="/dashboard/team" className="text-brick underline">Team page</Link>, then their scorecard
              appears here.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {cards.map((c, i) => (
              <Scorecard
                key={c.email}
                name={c.name}
                score={c.score}
                regions={c.regions}
                rank={i + 1}
                badges={earnedBadges({ score: c.score, rank: i + 1, totalCaptains: cards.length })}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  // Captain's own scorecard — pull from the ranked set so their rank (and the
  // top-of-board badge) is accurate.
  const all = await gatherCaptainScorecards();
  const idx = email ? all.findIndex((c) => c.email === email.toLowerCase()) : -1;
  const card = idx >= 0 ? all[idx] : null;
  return (
    <>
      <PageHeader kicker="Field" title="My scorecard" />
      <HowTo steps={HOW_TO} />
      {card ? (
        <div className="mt-6 max-w-xl">
          <Scorecard
            name={card.name}
            score={card.score}
            regions={card.regions}
            rank={idx + 1}
            badges={earnedBadges({ score: card.score, rank: idx + 1, totalCaptains: all.length })}
          />
        </div>
      ) : (
        <div className="mt-6 card p-6">
          <p className="font-display text-lg text-ink">Your scorecard is warming up</p>
          <p className="mt-2 max-w-2xl text-sm text-slate">
            Once you&rsquo;re set up as a captain with a region and volunteers on your team, your score and next best
            action show up here. Start with the{" "}
            <Link href="/dashboard/playbook" className="text-brick underline">captain playbook</Link>.
          </p>
        </div>
      )}
    </>
  );
}
