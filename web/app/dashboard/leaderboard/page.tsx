import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { gatherCaptainScorecards } from "@/lib/volunteers/score-data";
import { earnedBadges } from "@/lib/volunteers/badges";
import { TIER_LABEL, NEXT_ACTION } from "@/lib/volunteers/score";

export const dynamic = "force-dynamic";

const tierCls: Record<string, string> = {
  excellent: "bg-field/10 text-field",
  strong: "bg-field/10 text-field",
  building: "bg-gold/15 text-ink",
  "needs-attention": "bg-brick/10 text-brick",
  new: "bg-ink/5 text-slate",
};

const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null);

export default async function LeaderboardPage() {
  const { role, email } = await staffGate();
  // Private to captains + admins (the people doing the organizing).
  if (!can(role, "manageVolunteers")) redirect("/dashboard?denied=leaderboard");
  const isAdmin = can(role, "manageTeam");
  const meEmail = (email ?? "").toLowerCase();

  const cards = await gatherCaptainScorecards();
  const ranked = cards.map((c, i) => {
    const rank = i + 1;
    return { ...c, rank, badges: earnedBadges({ score: c.score, rank, totalCaptains: cards.length }) };
  });

  // Nudges (admins): captains who'd most benefit from a check-in — lowest tiers,
  // with the same single next best action they see on their own scorecard.
  const needsNudge = isAdmin
    ? ranked.filter((c) => c.score.tier === "needs-attention" || (c.score.hasActivity && c.score.tier === "new"))
    : [];

  return (
    <>
      <PageHeader kicker="Field" title="Captain leaderboard" />
      <HowTo
        steps={[
          "Captains ranked by their scorecard — which rewards an engaged, right-sized, active team and a recent in-person event, not headcount.",
          "Badges mark real milestones: on the map, healthy team, no one left cold, activator, boots on the ground, and top of the board.",
          "Only captains and admins can see this board. Opted-out volunteers never factor into anyone's score.",
        ]}
      />

      {ranked.length === 0 ? (
        <div className="mt-6 card p-6">
          <p className="font-display text-lg text-ink">No captains on the board yet</p>
          <p className="mt-2 max-w-2xl text-sm text-slate">
            Promote a volunteer to captain and assign a region on the{" "}
            <Link href="/dashboard/team" className="text-brick underline">Team page</Link>; scores and rankings appear
            as captains build their teams.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-sm border border-line">
          {ranked.map((c) => {
            const mine = c.email === meEmail;
            return (
              <li
                key={c.email}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm ${mine ? "bg-gold/5" : ""}`}
              >
                <span className="w-8 shrink-0 font-display text-lg text-slate">
                  {medal(c.rank) ?? <span className="text-sm">#{c.rank}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink">
                    {isAdmin ? c.name : c.firstName}
                    {mine && <span className="ml-1.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-brick">you</span>}
                  </span>
                  {c.badges.length > 0 && (
                    <span className="ml-2" aria-label={`Badges: ${c.badges.map((b) => b.label).join(", ")}`}>
                      {c.badges.map((b) => (
                        <span key={b.id} aria-hidden title={b.label} className="mr-0.5">{b.icon}</span>
                      ))}
                    </span>
                  )}
                </span>
                <span className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${tierCls[c.score.tier]}`}>
                  {TIER_LABEL[c.score.tier]}
                </span>
                <span className="w-10 shrink-0 text-right font-display text-xl text-ink">
                  {c.score.hasActivity ? c.score.total : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {needsNudge.length > 0 && (
        <div className="mt-8">
          <p className="eyebrow text-brick">Captains who could use a nudge</p>
          <p className="mt-1 max-w-2xl text-sm text-slate">
            These captains are early or stalled. Reach out with the one move that would help them most.
          </p>
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {needsNudge.map((c) => {
              const next = c.score.weakest ? NEXT_ACTION[c.score.weakest] : null;
              return (
                <li key={c.email} className="px-4 py-3 text-sm">
                  <span className="text-ink">{c.name}</span>
                  {next && <span className="block text-[0.8rem] text-slate">{next.text}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
