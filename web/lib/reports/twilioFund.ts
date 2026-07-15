// Twilio-fund analysis (candidate/twilio-fund-plan.md) — PURE + testable. Given
// the opted-in SMS audience joined to voter scores, it produces the reachable
// cohorts and a priority budget allocation. It lives OUTSIDE lib/sms/ on purpose:
// it reads voter segments (@/lib/voters/score), and the SMS pipeline must stay
// voter-free (the TCPA isolation guard in lib/sms/audiences.voterfile-isolation
// .test.ts). Nothing here sends anything — it only analyzes. All dollar and
// touch figures are illustrative planning defaults, never predictions.
import { SEGMENTS, type Segment } from "@/lib/voters/score";

export type ReachCohorts = {
  optedIn: number; // total opted-in numbers (the textable audience)
  optedOut: number; // opted-out (STOP) numbers, for context
  matched: Record<Segment, number>; // opted-in numbers matched to a voter, by segment
  unmatched: number; // opted-in but not matched to any voter record
  universe: Record<Segment, number>; // the whole scored voter universe (growth ceiling)
};

// Illustrative SMS value weights by segment — DOCUMENTED priorities, not empirical
// lift. GOTV core first (supporters who need the turnout push), then reliable
// supporters (a light chase nudge), then persuadable habitual voters; prospects a
// trickle; opposition/inactive never gets budget. Re-weight with real canvass/lift
// data as it accrues (voter-file-plan.md §4).
export const SMS_PRIORITY: Record<Segment, number> = {
  MOBILIZE: 1.0,
  BANK: 0.8,
  PERSUADE: 0.5,
  PROSPECT: 0.15,
  MONITOR: 0,
};

// Illustrative message cadence per person over the plan window (the 4-3-2-1 GOTV
// schedule spirit, workflows/gotv-plan.md). Placeholder — set per campaign.
export const DEFAULT_TOUCHES: Record<Segment, number> = {
  MOBILIZE: 4,
  BANK: 3,
  PERSUADE: 2,
  PROSPECT: 1,
  MONITOR: 0,
};

export const emptySeg = (): Record<Segment, number> =>
  Object.fromEntries(SEGMENTS.map((s) => [s, 0])) as Record<Segment, number>;

export type MatchedPair = { segment: Segment; phone: string }; // phone already E.164

/**
 * Reduce raw joins into cohorts. `matched` pairs a voter's segment with the
 * E.164 phone of the campaign contact (donor/volunteer) they matched by name+ZIP;
 * a phone is counted once (first match wins) and only if it's actually opted in.
 * Pure.
 */
export function buildCohorts(args: {
  optedIn: Set<string>; // E.164 opted-in numbers
  optedOut: number;
  matched: MatchedPair[];
  universe: Record<Segment, number>;
}): ReachCohorts {
  const matched = emptySeg();
  const seen = new Set<string>();
  for (const m of args.matched) {
    if (!args.optedIn.has(m.phone) || seen.has(m.phone)) continue;
    seen.add(m.phone);
    matched[m.segment]++;
  }
  return {
    optedIn: args.optedIn.size,
    optedOut: args.optedOut,
    matched,
    unmatched: Math.max(0, args.optedIn.size - seen.size),
    universe: args.universe,
  };
}

export type AllocationRow = {
  segment: Segment;
  reachable: number; // opted-in matched numbers in this segment
  touches: number; // planned messages per person
  sends: number; // funded sends (reachable × touches, capped by budget)
  spendCents: number;
  share: number; // fraction of the total budget
  funded: "full" | "partial" | "none";
};

export type AllocationPlan = {
  rows: AllocationRow[];
  totalSends: number;
  totalSpendCents: number;
  budgetCents: number;
  leftoverCents: number;
};

/**
 * Greedy priority allocation: fund segments in SMS_PRIORITY order, each up to
 * reachable×touches sends at costPerSmsCents, until the budget runs out — the
 * last funded segment may be partially funded. Priority-0 segments (MONITOR) are
 * never funded. Rows are returned in SEGMENTS order for stable display. Pure.
 */
export function allocateBudget(
  cohorts: ReachCohorts,
  opts: { budgetCents: number; costPerSmsCents: number; touches?: Record<Segment, number> },
): AllocationPlan {
  const touches = opts.touches ?? DEFAULT_TOUCHES;
  const cost = Math.max(1, Math.round(opts.costPerSmsCents));
  const order = SEGMENTS.filter((s) => SMS_PRIORITY[s] > 0).sort((a, b) => SMS_PRIORITY[b] - SMS_PRIORITY[a]);

  const sends = emptySeg();
  let remaining = Math.max(0, Math.round(opts.budgetCents));
  for (const seg of order) {
    const want = cohorts.matched[seg] * (touches[seg] ?? 0);
    if (want <= 0) continue;
    const affordable = Math.floor(remaining / cost);
    const funded = Math.min(want, affordable);
    sends[seg] = funded;
    remaining -= funded * cost;
    if (remaining < cost) break; // budget exhausted
  }

  const rows: AllocationRow[] = SEGMENTS.map((seg) => {
    const reachable = cohorts.matched[seg];
    const t = touches[seg] ?? 0;
    const want = reachable * t;
    const s = sends[seg];
    const spendCents = s * cost;
    const funded: AllocationRow["funded"] = want === 0 ? "none" : s >= want ? "full" : s > 0 ? "partial" : "none";
    return {
      segment: seg,
      reachable,
      touches: t,
      sends: s,
      spendCents,
      share: opts.budgetCents > 0 ? spendCents / opts.budgetCents : 0,
      funded,
    };
  });

  const totalSpendCents = rows.reduce((n, r) => n + r.spendCents, 0);
  return {
    rows,
    totalSends: rows.reduce((n, r) => n + r.sends, 0),
    totalSpendCents,
    budgetCents: opts.budgetCents,
    leftoverCents: Math.max(0, Math.round(opts.budgetCents) - totalSpendCents),
  };
}

const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Render the generated data appendix as markdown (paste-ready under the report). */
export function renderReport(
  cohorts: ReachCohorts,
  plan: AllocationPlan,
  meta: { costPerSmsCents: number; generatedAt: string; source: string },
): string {
  const universeTotal = SEGMENTS.reduce((n, s) => n + (cohorts.universe[s] ?? 0), 0);
  const matchedTotal = SEGMENTS.reduce((n, s) => n + cohorts.matched[s], 0);
  const lines: string[] = [];
  lines.push(`_Generated ${meta.generatedAt} from ${meta.source}. Cost/SMS assumed ${usd(meta.costPerSmsCents)} (illustrative)._`);
  lines.push("");
  lines.push(`- **Opted-in (textable) numbers:** ${cohorts.optedIn.toLocaleString()}  ·  **opted-out:** ${cohorts.optedOut.toLocaleString()}`);
  lines.push(`- **Matched to a voter score:** ${matchedTotal.toLocaleString()}  ·  **opted-in but unmatched:** ${cohorts.unmatched.toLocaleString()}`);
  lines.push(`- **Scored voter universe (growth ceiling):** ${universeTotal.toLocaleString()}`);
  lines.push("");
  lines.push("| Segment | Opted-in & matched | Whole universe | Touches/person | Funded sends | Spend | Budget share |");
  lines.push("|---|--:|--:|--:|--:|--:|--:|");
  for (const r of plan.rows) {
    lines.push(
      `| ${r.segment} | ${r.reachable.toLocaleString()} | ${(cohorts.universe[r.segment] ?? 0).toLocaleString()} | ${r.touches} | ${r.sends.toLocaleString()} | ${usd(r.spendCents)} | ${(r.share * 100).toFixed(1)}% |`,
    );
  }
  lines.push(`| **Total** | **${matchedTotal.toLocaleString()}** | **${universeTotal.toLocaleString()}** | — | **${plan.totalSends.toLocaleString()}** | **${usd(plan.totalSpendCents)}** | **${plan.budgetCents > 0 ? ((plan.totalSpendCents / plan.budgetCents) * 100).toFixed(1) : "0.0"}%** |`);
  lines.push("");
  lines.push(`Budget ${usd(plan.budgetCents)} · allocated ${usd(plan.totalSpendCents)} · unallocated ${usd(plan.leftoverCents)}.`);
  return lines.join("\n");
}
