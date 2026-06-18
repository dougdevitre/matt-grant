import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { CAMPAIGN, PRIORITIES } from "@/lib/site";

// Structured view of candidate/strategic-plan.md. All figures are ILLUSTRATIVE
// planning placeholders — not predictions, not real data. Frameworks are drawn
// from the get-elected skill (campaign-plan-builder, gotv-plan, fundraising-plan,
// low-cost-high-impact, states/missouri).

const PHASES = [
  {
    phase: "Build",
    window: "now → early April",
    aim: "Foundation: committee, compliance, plan, and a vote goal.",
    moves: [
      "Committee + treasurer live; FEC Form 2 & 3 cadence set",
      "Confirm MO ballot access with the Secretary of State",
      "Set the vote goal and budget (campaign-plan-builder)",
      "Stand up CRM, list, and call-time engine",
    ],
  },
  {
    phase: "Fund",
    window: "April → mid-June",
    aim: "Raise the resources to be heard — efficiency over flash.",
    moves: [
      "10 hrs/week candidate call time, every week",
      "Build a small-dollar WinRed program around the CHILD Protection Act",
      "Host 3–4 low-overhead house parties across the district",
      "Hit the first fundraising milestone (illustrative)",
    ],
  },
  {
    phase: "Persuade",
    window: "June → mid-July",
    aim: "Define the race on Matt's terms: children first, clean courts.",
    moves: [
      "Seat 25 precinct captains; begin door + phone universe",
      "Earned media on family-court reform and term limits",
      "Targeted digital + mail to persuadable primary voters",
      "Town halls in the highest-turnout precincts",
    ],
  },
  {
    phase: "GOTV",
    window: "mid-July → Aug 4",
    aim: "Turn out every identified supporter. Chase the vote.",
    moves: [
      "Absentee / early-vote chase (ballot-chase-program)",
      "Daily ID + persuasion canvass and phone shifts",
      "Election Day: staffed boiler room, ride-to-polls, full chase",
      "Poll-watching + election-protection coverage",
    ],
  },
];

const VOTE_MATH = [
  ["Projected primary turnout", "— (set from MO-02 history)"],
  ["Votes needed to win", "≈ 50% + 1 of the field"],
  ["Win number (illustrative)", "set after turnout model"],
  ["Daily voter contacts to hit it", "derived from win number ÷ days"],
];

export default function PlanPage() {
  return (
    <>
      <PageHeader kicker="Strategy" title={`Plan to win ${CAMPAIGN.districtShort}`} />

      <HowTo
        steps={[
          "Start with the theory of victory at the top — the one idea the whole plan serves.",
          "Walk the four phases (Build → Fund → Persuade → GOTV) and their key moves, in order, to see what comes next.",
          "Use the vote-math table to set the win number; the figures are illustrative until you plug in real MO-02 turnout history.",
          "Keep the message pillars in view so every tactic ladders back to the platform.",
          "This is a structured mirror of candidate/strategic-plan.md — edit the narrative there for lasting changes.",
        ]}
      />

      <div className="mb-6 rounded-sm border border-field/30 bg-field/5 px-5 py-4 text-sm text-slate">
        <span className="font-semibold text-ink">Theory of victory:</span> In a {CAMPAIGN.electionLabel}{" "}
        primary, turnout is small and intense. Matt wins by owning one clear, urgent idea — putting
        children first by cleaning up the family-court system — and out-organizing the field with a
        disciplined, low-cost, high-contact ground game. All numbers below are illustrative planning
        placeholders, not predictions.
      </div>

      {/* Phases */}
      <div className="grid gap-4 lg:grid-cols-2">
        {PHASES.map((p) => (
          <div key={p.phase} className="card p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="star font-display text-xl font-semibold text-ink">{p.phase}</h2>
              <span className="font-mono text-xs text-slate">{p.window}</span>
            </div>
            <p className="mt-2 text-sm text-slate">{p.aim}</p>
            <ul className="mt-4 space-y-2">
              {p.moves.map((m) => (
                <li key={m} className="flex gap-2 text-sm text-ink">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Vote math + messaging */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <p className="eyebrow text-slate">Vote math (framework)</p>
          <table className="mt-4 w-full text-sm">
            <tbody className="divide-y divide-line">
              {VOTE_MATH.map(([k, v]) => (
                <tr key={k}>
                  <td className="py-2.5 text-slate">{k}</td>
                  <td className="py-2.5 text-right font-mono text-ink">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate">Populate from states/missouri turnout history. Illustrative only.</p>
        </div>

        <div className="card p-6">
          <p className="eyebrow text-slate">Message pillars</p>
          <ul className="mt-4 space-y-3">
            {PRIORITIES.map((p) => (
              <li key={p.id} className="flex gap-3">
                <span className="font-mono text-xs text-gold">{p.n}</span>
                <div>
                  <p className="font-semibold text-ink">{p.title}</p>
                  <p className="text-xs text-slate">{p.short}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate">
        Full narrative in <span className="font-mono">candidate/strategic-plan.md</span>. Frameworks from the
        get-elected skill. Educational planning tool — not legal or financial advice; verify all compliance with the FEC and Missouri Ethics Commission.
      </p>
    </>
  );
}
