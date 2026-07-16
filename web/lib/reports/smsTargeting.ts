// SMS voter-targeting — PURE + testable. Turns an already-opted-in, voter-scored
// recipient list into a RANKED, budget-capped send list that reaches the highest-
// value people first (candidate/sms-targeting-plan.md, Phase 3). It lives OUTSIDE
// lib/sms/ on purpose: it references voter Segment types, and the SMS send path
// must stay voter-free (the TCPA isolation guard,
// lib/sms/audiences.voterfile-isolation.test.ts). Recipients arrive here ALREADY
// opted-in AND already enriched with denormalized voter fields by an out-of-band
// job — nothing here reads the voter file, and nothing here sends.
import { SEGMENTS, type Segment } from "@/lib/voters/score";
import { SMS_PRIORITY } from "./twilioFund";

export type ScoredRecipient = {
  phone: string; // E.164, already opted-in (the send path re-checks opt-in at drain)
  segment?: Segment; // from the out-of-band voter match; undefined = unscored (no name+ZIP match)
  t?: number; // turnout propensity 0-5
  banked?: boolean; // already returned a ballot — GOTV suppression
  first?: string;
};

// Unscored opted-ins (no voter match) get a small positive floor so they rank
// last — reachable only when budget remains and includeUnscored is set.
const UNSCORED_FLOOR = 0.05;

/**
 * Text-first priority for one recipient (higher = sooner). The segment weight
 * (SMS_PRIORITY, the same weights the fund report uses) dominates; turnout T is a
 * small within-segment tie-break so the most reliable voters lead their group.
 * MONITOR (weight 0) and unscored recipients sink to the bottom.
 */
export function recipientPriority(r: ScoredRecipient): number {
  const base = r.segment ? SMS_PRIORITY[r.segment] : UNSCORED_FLOOR;
  const t = typeof r.t === "number" ? Math.max(0, Math.min(5, r.t)) : 0;
  return base + t / 100; // tie-break only: 0..0.05, never crosses a segment boundary
}

export type TargetOpts = {
  segments?: Segment[]; // restrict to these segments (default: all with priority > 0)
  excludeBanked?: boolean; // GOTV mode: drop voters who already returned a ballot
  includeUnscored?: boolean; // include opted-ins with no voter match (default false)
  budgetCents?: number; // cap total spend; omit for no cap
  costPerSmsCents?: number; // default 2
  touches?: number; // messages per recipient this send (default 1)
};

export type SendList = {
  selected: ScoredRecipient[]; // ranked, highest-value first, within budget
  bySegment: Record<string, number>;
  droppedBanked: number;
  droppedOffTarget: number; // filtered out by segment / unscored rules
  totalSends: number;
  spendCents: number;
  capped: boolean; // true when the budget cut the eligible list short
};

/**
 * Rank an opted-in, voter-scored audience into a budget-capped send list —
 * highest-value first. Pure; deterministic tie-break by phone so re-runs match.
 */
export function buildSendList(recipients: ScoredRecipient[], opts: TargetOpts = {}): SendList {
  const cost = Math.max(1, Math.round(opts.costPerSmsCents ?? 2));
  const touches = Math.max(1, Math.round(opts.touches ?? 1));
  const allow = new Set<Segment>(opts.segments ?? SEGMENTS.filter((s) => SMS_PRIORITY[s] > 0));

  let droppedBanked = 0;
  let droppedOffTarget = 0;
  const eligible: ScoredRecipient[] = [];
  for (const r of recipients) {
    if (opts.excludeBanked && r.banked) {
      droppedBanked++;
      continue;
    }
    if (r.segment) {
      if (!allow.has(r.segment)) {
        droppedOffTarget++;
        continue;
      }
    } else if (!opts.includeUnscored) {
      droppedOffTarget++;
      continue;
    }
    eligible.push(r);
  }

  eligible.sort((a, b) => recipientPriority(b) - recipientPriority(a) || a.phone.localeCompare(b.phone));

  const affordable =
    opts.budgetCents != null ? Math.floor(Math.max(0, opts.budgetCents) / (cost * touches)) : eligible.length;
  const selected = eligible.slice(0, affordable);

  const bySegment: Record<string, number> = {};
  for (const r of selected) {
    const k = r.segment ?? "UNSCORED";
    bySegment[k] = (bySegment[k] ?? 0) + 1;
  }
  const totalSends = selected.length * touches;
  return {
    selected,
    bySegment,
    droppedBanked,
    droppedOffTarget,
    totalSends,
    spendCents: totalSends * cost,
    capped: selected.length < eligible.length,
  };
}
