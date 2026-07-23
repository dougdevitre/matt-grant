// SMS spend model — PURE + testable. The math behind the dashboard's Spend
// Decider page (/dashboard/sms/spend): turn a message's segment count, Twilio
// per-segment pricing, and a budget into cost-per-text / per-blast / calendar
// figures and the "Max texts" cap to enter in the composer. Lives in
// lib/reports/ beside smsTargeting.ts because it reuses the voter-segment
// priority order; nothing here reads any data store or sends anything, and all
// dollar figures are planning estimates, not invoices.
import { SEGMENTS, type Segment } from "@/lib/voters/score";
import { SMS_PRIORITY } from "./twilioFund";

export type SpendInput = {
  segments: number; // SMS segments per message (from smsSegments())
  basePerSegCents: number; // Twilio base rate per outbound segment, in cents
  carrierPerSegCents: number; // carrier surcharge per outbound segment, in cents
  replyRatePct: number; // expected % of recipients who reply (0-100)
  listSize: number; // opted-in audience size
  sends: number; // broadcasts in the plan
  budgetCents: number; // total budget across all sends; 0 = no budget entered
};

export type SpendModel = {
  perTextCents: number; // outbound segments + expected reply loading, per recipient
  perBlastCents: number;
  calendarCents: number; // perBlast × sends
  capPerBlast: number | null; // Max texts to enter in the composer; null = no cap needed
  coveragePct: number; // share of the list a capped blast reaches (0-100); 100 when uncapped
};

// Twilio US toll-free planning defaults (verify at twilio.com/en-us/sms/pricing/us before
// budgeting). Shared by the Spend Decider page AND the composer's inline budget field so the
// two can't drift — base $0.0079/segment, mid-range carrier surcharge $0.0045/segment, a 5%
// expected reply rate. In CENTS to match SpendInput.
export const SMS_PRICING_DEFAULTS = { basePerSegCents: 0.79, carrierPerSegCents: 0.45, replyRatePct: 5 } as const;

/** Cost of one recipient replying: one inbound segment (base only — carrier
 *  fees are outbound) plus the vote agent's ~2-segment answer. */
export function replyCostCents(basePerSegCents: number, carrierPerSegCents: number): number {
  return basePerSegCents + 2 * (basePerSegCents + carrierPerSegCents);
}

export function spendModel(i: SpendInput): SpendModel {
  const perSeg = Math.max(0, i.basePerSegCents) + Math.max(0, i.carrierPerSegCents);
  const replyRate = Math.min(100, Math.max(0, i.replyRatePct)) / 100;
  const perText =
    Math.max(0, i.segments) * perSeg + replyRate * replyCostCents(Math.max(0, i.basePerSegCents), Math.max(0, i.carrierPerSegCents));
  const list = Math.max(0, Math.floor(i.listSize));
  const sends = Math.max(1, Math.floor(i.sends));
  const perBlast = list * perText;
  const budget = Math.max(0, i.budgetCents);

  let cap: number | null = null;
  let coverage = 100;
  if (budget > 0 && perText > 0) {
    const affordable = Math.floor(budget / sends / perText);
    if (affordable < list) {
      cap = affordable;
      coverage = list > 0 ? (affordable / list) * 100 : 0;
    }
  }
  return { perTextCents: perText, perBlastCents: perBlast, calendarCents: perBlast * sends, capPerBlast: cap, coveragePct: coverage };
}

// Priority order for the coverage table: the send path queues by SMS_PRIORITY
// (lib/reports/smsTargeting.ts), with unscored numbers at a small floor above
// MONITOR — mirror that exactly so the table shows where a cap actually lands.
export const UNSCORED_KEY = "UNSCORED";
export const COVERAGE_ORDER: readonly string[] = [
  ...[...SEGMENTS].sort((a, b) => SMS_PRIORITY[b] - SMS_PRIORITY[a]).filter((s) => SMS_PRIORITY[s] > 0),
  UNSCORED_KEY,
  ...SEGMENTS.filter((s) => SMS_PRIORITY[s] === 0),
];

export type CoverageRow = {
  key: string; // Segment or UNSCORED
  count: number;
  cumulative: number; // texts through this row
  cumulativeCents: number;
  status: "within" | "partial" | "beyond"; // vs the cap; all "within" when uncapped
};

/** Cumulative cost down the priority order, flagging where a capped blast stops.
 *  `counts` keys are Segment names + UNSCORED; missing keys count as 0. */
export function coverageRows(
  counts: Partial<Record<string, number>>,
  perTextCents: number,
  capPerBlast: number | null,
): CoverageRow[] {
  const cap = capPerBlast ?? Infinity;
  let cum = 0;
  return COVERAGE_ORDER.map((key) => {
    const count = Math.max(0, Math.floor(counts[key] ?? 0));
    const before = cum;
    cum += count;
    const status: CoverageRow["status"] = cum <= cap ? "within" : before < cap ? "partial" : "beyond";
    return { key, count, cumulative: cum, cumulativeCents: cum * perTextCents, status };
  });
}

/** Illustrative fallback counts (candidate/twilio-fund-plan.md §3) for when the
 *  consent ledger has no enrichment tags yet. The UI labels these clearly. */
export const ILLUSTRATIVE_COUNTS: Record<string, number> = {
  MOBILIZE: 600,
  BANK: 700,
  PERSUADE: 800,
  PROSPECT: 500,
  [UNSCORED_KEY]: 1600,
  MONITOR: 0,
};

export type Seg = Segment;
