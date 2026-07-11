import Link from "next/link";
import { redirect } from "next/navigation";
import { DbNotice, PageHeader } from "@/components/dashboard/Notice";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dbConfigured } from "@/lib/db";
import { CAMPAIGN } from "@/lib/site";
import { listShifts } from "@/lib/coverage/shiftStore";
import { fillStats } from "@/lib/coverage/shifts";
import { getVolunteers } from "@/lib/queries";
import { listActiveCaptains } from "@/lib/volunteers/captains";
import { listSignPlacements } from "@/lib/signs/store";
import { signVerified } from "@/lib/signs/geo";
import { chaseReport } from "@/lib/voters/chase";
import { listBallotAggs } from "@/lib/voters/returnsStore";
import { listVoterAggs } from "@/lib/voters/store";
import {
  activeContactRound,
  CONTACT_SCHEDULE,
  daysUntil,
  GOTV_TIMELINE,
  KEY_DATES,
  timelineStatus,
} from "@/lib/gotv/warRoom";

export const dynamic = "force-dynamic";

const num = (n: number) => n.toLocaleString("en-US");

// The GOTV war room: one read-only screen for the final stretch — countdowns,
// a live snapshot of every field system (each linking to its page), the GOTV
// timeline and 4-3-2-1 schedule from workflows/gotv-plan.md with countdown
// status. Every section degrades independently; aggregates only, no PII here.
export default async function WarRoomPage() {
  const { role } = await staffGate();
  if (!can(role, "manageTeam")) redirect("/dashboard?denied=war-room");
  const canChase = can(role, "viewVoterFile");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); // YYYY-MM-DD, campaign time
  const electionDay = CAMPAIGN.electionDate.slice(0, 10);
  const toElection = daysUntil(electionDay, today);
  const toEarlyVote = daysUntil(KEY_DATES.earlyVoteStart, today);
  const evOpen = toEarlyVote <= 0 && daysUntil(KEY_DATES.earlyVoteEnd, today) >= 0;
  const statuses = timelineStatus(toElection);
  const liveRound = activeContactRound(toElection);

  // Best-effort loads — a failed source renders its honest empty state, never a crash.
  const [aggs, ballotAggs, shifts, vols, captains, signs] = await Promise.all([
    canChase ? listVoterAggs().catch(() => []) : Promise.resolve([]),
    canChase ? listBallotAggs().catch(() => []) : Promise.resolve([]),
    listShifts().catch(() => []),
    getVolunteers().catch(() => ({ connected: false, rows: [] })),
    listActiveCaptains().catch(() => []),
    listSignPlacements().catch(() => []),
  ]);
  const chase = aggs.length ? chaseReport(aggs, ballotAggs) : null;
  const shiftStat = shifts.length ? fillStats(shifts) : null;
  const volActive = vols.rows.filter((v) => v.status === "ACTIVE").length;
  const signsVerified = signs.filter((s) => signVerified(s)).length;

  const countdown = (label: string, value: string, tone?: "brick" | "field") => (
    <div className="card p-4 text-center">
      <p className={`font-display text-3xl ${tone === "brick" ? "text-brick" : tone === "field" ? "text-field" : "text-ink"}`}>{value}</p>
      <p className="mt-0.5 text-[0.7rem] uppercase tracking-eyebrow text-slate">{label}</p>
    </div>
  );

  return (
    <>
      <PageHeader kicker="Field" title="War room" />
      <p className="mt-2 max-w-3xl text-sm text-slate">
        The final-stretch overview: every field system at a glance, on the clock of{" "}
        <span className="font-mono">workflows/gotv-plan.md</span>. Numbers link to the page that owns them.
      </p>

      {!dbConfigured && <DbNotice />}

      {/* Countdown */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {toEarlyVote > 0
          ? countdown("Days until early voting (Jul 21)", String(toEarlyVote), "brick")
          : evOpen
            ? countdown("Early voting is OPEN (through Aug 3)", `${daysUntil(KEY_DATES.earlyVoteEnd, today)} days left`, "field")
            : countdown("Early voting", "Closed", undefined)}
        {toElection >= 0
          ? countdown("Days until the primary (Aug 4)", String(toElection), toElection <= 7 ? "brick" : undefined)
          : countdown("Primary", "Complete", undefined)}
        {countdown("Today", today, undefined)}
      </div>

      {liveRound && (
        <div className="mt-4 rounded-sm border border-brick/40 bg-brick/5 p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-eyebrow text-brick">4-3-2-1 · live now · {liveRound.label} out</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {liveRound.contact} — {liveRound.method}
          </p>
          <p className="mt-0.5 text-sm text-slate">&ldquo;{liveRound.message}&rdquo;</p>
        </div>
      )}

      {/* System snapshot */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/voters/chase" className="card block p-4 hover:border-field">
          <p className="eyebrow text-slate">Ballot chase</p>
          {chase ? (
            <>
              <p className="mt-1 font-display text-2xl text-ink">
                {num(chase.banked)} <span className="text-base text-slate">/ {num(chase.universe)}</span>
              </p>
              <p className="text-xs text-slate">
                banked · {chase.pctComplete}% · <span className="text-brick">{num(chase.outstanding)} outstanding</span>
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate">
              {canChase ? "Awaiting the voter-file ingest (Voter database has the runbook)." : "Admin-only numbers."}
            </p>
          )}
        </Link>
        <Link href="/dashboard/coverage/shifts" className="card block p-4 hover:border-field">
          <p className="eyebrow text-slate">Poll shifts</p>
          {shiftStat ? (
            <>
              <p className="mt-1 font-display text-2xl text-ink">{shiftStat.fillPct}%</p>
              <p className="text-xs text-slate">
                {num(shiftStat.covered)} covered · {num(shiftStat.partial)} partial ·{" "}
                <span className={shiftStat.uncovered ? "text-brick" : ""}>{num(shiftStat.uncovered)} uncovered</span>
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate">No shifts generated yet — build the Jul 21-Aug 4 schedule.</p>
          )}
        </Link>
        <Link href="/dashboard/volunteers" className="card block p-4 hover:border-field">
          <p className="eyebrow text-slate">People</p>
          <p className="mt-1 font-display text-2xl text-ink">
            {num(vols.rows.length)} <span className="text-base text-slate">volunteers</span>
          </p>
          <p className="text-xs text-slate">
            {num(volActive)} active · {num(captains.length)} captains
          </p>
        </Link>
        <Link href="/dashboard/signs" className="card block p-4 hover:border-field">
          <p className="eyebrow text-slate">Signs</p>
          <p className="mt-1 font-display text-2xl text-ink">
            {num(signsVerified)} <span className="text-base text-slate">/ {num(signs.length)}</span>
          </p>
          <p className="text-xs text-slate">
            verified · <span className={signs.length - signsVerified ? "text-brick" : ""}>{num(signs.length - signsVerified)} pending gates</span>
          </p>
        </Link>
      </div>

      {/* GOTV timeline */}
      <div className="mt-6 card overflow-hidden p-0">
        <p className="eyebrow px-5 pt-4 text-slate">GOTV timeline (workflows/gotv-plan.md)</p>
        <ul className="mt-2 divide-y divide-line">
          {GOTV_TIMELINE.map((r, i) => (
            <li key={r.when} className={`flex items-baseline gap-3 px-5 py-2.5 ${statuses[i] === "current" ? "bg-gold/10" : ""}`}>
              <span
                className={`w-5 shrink-0 text-center font-mono text-xs ${
                  statuses[i] === "done" ? "text-field" : statuses[i] === "current" ? "text-brick" : "text-line"
                }`}
                aria-hidden
              >
                {statuses[i] === "done" ? "✓" : statuses[i] === "current" ? "▶" : "·"}
              </span>
              <span className="w-28 shrink-0 font-mono text-[0.65rem] uppercase tracking-eyebrow text-slate">{r.when}</span>
              <span className={`text-sm ${statuses[i] === "current" ? "font-semibold text-ink" : "text-slate"}`}>{r.action}</span>
              <span className="ml-auto shrink-0 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">{statuses[i]}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 4-3-2-1 schedule */}
      <div className="mt-4 card overflow-hidden p-0">
        <p className="eyebrow px-5 pt-4 text-slate">The 4-3-2-1 contact schedule</p>
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-slate">
            <tr>
              {["Days out", "Contact", "Method", "Message"].map((h) => (
                <th key={h} className="whitespace-nowrap px-5 py-2 font-mono text-[0.65rem] uppercase tracking-eyebrow">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {CONTACT_SCHEDULE.map((r) => (
              <tr key={r.daysOut} className={liveRound?.daysOut === r.daysOut ? "bg-brick/5" : "hover:bg-paper"}>
                <td className="px-5 py-2 font-mono text-xs">{r.label}{liveRound?.daysOut === r.daysOut ? " · LIVE" : ""}</td>
                <td className="px-5 py-2 text-ink">{r.contact}</td>
                <td className="px-5 py-2 text-slate">{r.method}</td>
                <td className="px-5 py-2 text-xs text-slate">&ldquo;{r.message}&rdquo;</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-5 py-3 text-[0.7rem] text-slate">
          Verbatim from <span className="font-mono">workflows/gotv-plan.md</span> — each contact carries the polling
          location, hours, and what to bring. Early-voting states start GOTV earlier (that&apos;s the timeline above).
        </p>
      </div>
    </>
  );
}
