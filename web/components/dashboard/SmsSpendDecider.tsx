"use client";

import { useMemo, useState } from "react";
import { smsSegments, nonGsmChars, withCompliance } from "@/lib/sms/templates";
import {
  spendModel,
  coverageRows,
  COVERAGE_ORDER,
  ILLUSTRATIVE_COUNTS,
  UNSCORED_KEY,
  SMS_PRICING_DEFAULTS,
} from "@/lib/reports/smsSpend";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-field";

// Data comes from the server page (audiences.ts reads DynamoDB, so it must not
// be imported into this client bundle): the live opted-in count and the real
// per-segment counts from the enrichment tags. When no tags exist yet the page
// passes zeros and this component falls back to clearly-labeled illustrative
// placeholders (candidate/twilio-fund-plan.md §3).
export type SpendDeciderProps = {
  optedIn: number;
  segmentCounts: Record<string, number>; // Segment name (+ UNSCORED) → opted-in count
};

const usd = (cents: number, digits = 2) =>
  "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const DEFAULT_MESSAGE = withCompliance(
  "Hi {first}, early voting in the MO-02 primary starts TOMORROW. Vote in person at your county election office July 21-Aug 3, no excuse needed. Mail-ballot applications are due Wed July 22 by 5pm. Reply VOTE for where to go.",
);

export function SmsSpendDecider({ optedIn, segmentCounts }: SpendDeciderProps) {
  const haveRealCounts = Object.values(segmentCounts).some((n) => n > 0);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [base, setBase] = useState(String(SMS_PRICING_DEFAULTS.basePerSegCents / 100));
  const [fee, setFee] = useState(String(SMS_PRICING_DEFAULTS.carrierPerSegCents / 100));
  const [replies, setReplies] = useState(String(SMS_PRICING_DEFAULTS.replyRatePct));
  const [list, setList] = useState(String(optedIn > 0 ? optedIn : 1000));
  const [sends, setSends] = useState("7");
  const [budget, setBudget] = useState("150");
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    haveRealCounts ? { ...ILLUSTRATIVE_COUNTS, ...segmentCounts } : { ...ILLUSTRATIVE_COUNTS },
  );

  const seg = useMemo(() => smsSegments(message.replace(/\{first\}/g, "Jordan")), [message]);
  const offenders = useMemo(() => (seg.encoding === "UCS-2" ? nonGsmChars(message) : []), [seg.encoding, message]);

  const num = (s: string) => {
    const v = parseFloat(s);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };
  const model = useMemo(
    () =>
      spendModel({
        segments: seg.segments,
        basePerSegCents: num(base) * 100,
        carrierPerSegCents: num(fee) * 100,
        replyRatePct: num(replies),
        listSize: num(list),
        sends: num(sends),
        budgetCents: num(budget) * 100,
      }),
    [seg.segments, base, fee, replies, list, sends, budget],
  );
  const rows = useMemo(
    () => coverageRows(counts, model.perTextCents, model.capPerBlast),
    [counts, model.perTextCents, model.capPerBlast],
  );
  const countsTotal = COVERAGE_ORDER.reduce((a, k) => a + (counts[k] ?? 0), 0);
  const listN = Math.floor(num(list));
  const sendsN = Math.max(1, Math.floor(num(sends)));
  const budgetCents = num(budget) * 100;

  const setCount = (key: string, v: string) => {
    const n = parseInt(v, 10);
    setCounts((cur) => ({ ...cur, [key]: Number.isFinite(n) && n >= 0 ? n : 0 }));
  };

  const label = "text-xs font-semibold text-slate";
  const chip = "rounded-sm border border-line bg-paper px-2 py-0.5 font-mono text-[0.65rem] text-ink";

  return (
    <div className="space-y-6">
      {/* 1 · Message */}
      <div className="card p-6">
        <p className="eyebrow text-brick">1 · The message</p>
        <p className="mt-1 text-xs text-slate">
          Paste the text exactly as it will send (disclaimer included — it rides on every broadcast). The
          segment count drives the whole cost model.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${field} mt-3 min-h-28 font-mono text-xs leading-5`}
          aria-label="Message text"
          spellCheck={false}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={chip}>{seg.chars} chars</span>
          <span className={chip}>{seg.encoding}</span>
          <span className={chip}>
            {seg.segments} segment{seg.segments === 1 ? "" : "s"}
          </span>
        </div>
        {seg.encoding === "UCS-2" && (
          <p className="mt-2 text-xs text-brick">
            ⚠ A special character{offenders.length ? ` (${offenders.join(" ")})` : ""} is forcing pricier UCS-2
            encoding — 70 chars per segment instead of 160. Replace smart quotes, dashes, or emoji with plain
            text to cut the cost.
          </p>
        )}
      </div>

      {/* 2 · Pricing */}
      <div className="card p-6">
        <p className="eyebrow text-brick">2 · Twilio pricing</p>
        <p className="mt-1 text-xs text-slate">
          Defaults are Twilio&apos;s published US toll-free rates as of July 2026 —{" "}
          <strong className="text-ink">verify before budgeting</strong> at{" "}
          <a className="text-field underline" href="https://www.twilio.com/en-us/sms/pricing/us" target="_blank" rel="noopener noreferrer">
            twilio.com/en-us/sms/pricing/us
          </a>
          . Carrier fees vary by receiving carrier (~$0.003–$0.0065/segment); the default is a mid-range
          planning figure. Replies cost inbound + the vote agent&apos;s ~2-segment answer.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <div className="min-w-36 flex-1">
            <label className={label} htmlFor="spend-base">Base $/segment</label>
            <input id="spend-base" type="number" step="0.0001" min="0" value={base} onChange={(e) => setBase(e.target.value)} className={`${field} mt-1`} />
          </div>
          <div className="min-w-36 flex-1">
            <label className={label} htmlFor="spend-fee">Carrier fee $/segment</label>
            <input id="spend-fee" type="number" step="0.0001" min="0" value={fee} onChange={(e) => setFee(e.target.value)} className={`${field} mt-1`} />
          </div>
          <div className="min-w-36 flex-1">
            <label className={label} htmlFor="spend-replies">Expected replies %</label>
            <input id="spend-replies" type="number" step="1" min="0" max="100" value={replies} onChange={(e) => setReplies(e.target.value)} className={`${field} mt-1`} />
          </div>
        </div>
      </div>

      {/* 3 · Audience, budget, verdict */}
      <div className="card p-6">
        <p className="eyebrow text-brick">3 · Audience &amp; budget</p>
        <p className="mt-1 text-xs text-slate">
          List size is prefilled with the live opted-in count{optedIn > 0 ? ` (${optedIn.toLocaleString()})` : " (none yet — using 1,000 as a planning figure)"}. Sends = broadcasts in the approved calendar.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <div className="min-w-36 flex-1">
            <label className={label} htmlFor="spend-list">Opted-in list size</label>
            <input id="spend-list" type="number" step="1" min="0" value={list} onChange={(e) => setList(e.target.value)} className={`${field} mt-1`} />
          </div>
          <div className="min-w-36 flex-1">
            <label className={label} htmlFor="spend-sends">Sends in plan</label>
            <input id="spend-sends" type="number" step="1" min="1" value={sends} onChange={(e) => setSends(e.target.value)} className={`${field} mt-1`} />
          </div>
          <div className="min-w-36 flex-1">
            <label className={label} htmlFor="spend-budget">Total budget $</label>
            <input id="spend-budget" type="number" step="5" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} className={`${field} mt-1`} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { l: "Cost per text", v: usd(model.perTextCents, 4) },
            { l: "Cost per blast", v: usd(model.perBlastCents) },
            { l: "Full calendar", v: `${usd(model.calendarCents)} (${sendsN} sends)` },
          ].map((t) => (
            <div key={t.l} className="rounded-sm border border-line bg-paper px-4 py-3">
              <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">{t.l}</p>
              <p className="text-lg font-semibold tabular-nums text-ink">{t.v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-sm border border-brick/60 bg-white p-4">
          {budgetCents <= 0 ? (
            <p className="text-sm text-slate">Enter a total budget to get a per-blast Max texts cap.</p>
          ) : model.capPerBlast === null ? (
            <>
              <p className="font-display text-2xl font-semibold text-ink">No cap needed</p>
              <p className="mt-1 text-sm text-slate">
                {usd(budgetCents)} covers the full {listN.toLocaleString()}-person list for all {sendsN} sends
                ({usd(model.calendarCents)} total) with {usd(budgetCents - model.calendarCents)} headroom for
                replies and list growth. Leave Max texts blank in the composer.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-3xl font-semibold tabular-nums text-brick">
                {model.capPerBlast.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-ink">
                Enter this in the composer&apos;s <strong>Max texts</strong> field. {usd(budgetCents)} across{" "}
                {sendsN} sends funds {model.capPerBlast.toLocaleString()} texts per blast — the top{" "}
                {Math.round(model.coveragePct)}% of the list by voter priority.
              </p>
              <p className="mt-1 text-xs text-slate">
                Everyone below the cap line simply isn&apos;t sent that blast; nobody is removed from the list.
              </p>
            </>
          )}
        </div>
      </div>

      {/* 4 · Priority coverage */}
      <div className="card p-6">
        <p className="eyebrow text-brick">4 · Where a capped blast lands (priority order)</p>
        <p className="mt-1 text-xs text-slate">
          Broadcasts queue highest-likelihood voters first, so a cap cuts from the bottom.{" "}
          {haveRealCounts ? (
            "Counts are the live enrichment tags on the opted-in ledger; edit to model scenarios."
          ) : (
            <strong className="text-gold-ink">
              Counts are illustrative placeholders — run npm run enrich:sms to tag real voter scores, then
              reload.
            </strong>
          )}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[0.65rem] uppercase tracking-eyebrow text-slate">
                <th className="py-2 pr-3 font-semibold">Priority</th>
                <th className="py-2 pr-3 font-semibold">Group</th>
                <th className="py-2 pr-3 font-semibold">Count</th>
                <th className="py-2 pr-3 font-semibold">Cumulative texts</th>
                <th className="py-2 pr-3 font-semibold">Cumulative $/blast</th>
                <th className="py-2 font-semibold">Within cap?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className={`border-b border-line last:border-0 ${r.status === "beyond" ? "text-slate" : "text-ink"}`}>
                  <td className="py-2 pr-3 tabular-nums">{i + 1}</td>
                  <td className="py-2 pr-3">{r.key === UNSCORED_KEY ? "Unscored" : r.key}</td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={counts[r.key] ?? 0}
                      onChange={(e) => setCount(r.key, e.target.value)}
                      className="w-24 rounded-sm border border-line bg-white px-2 py-1 text-sm outline-none focus:border-field"
                      aria-label={`${r.key === UNSCORED_KEY ? "Unscored" : r.key} count`}
                    />
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{r.cumulative.toLocaleString()}</td>
                  <td className="py-2 pr-3 tabular-nums">{usd(r.cumulativeCents)}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow ${
                        r.status === "within"
                          ? "bg-field/10 text-field"
                          : r.status === "partial"
                            ? "bg-ink text-paper" // high-contrast: tinted gold fails WCAG at this size
                            : "bg-paper text-slate"
                      }`}
                    >
                      {model.capPerBlast === null ? "fully sent" : r.status === "partial" ? "cap lands here" : r.status === "within" ? "within cap" : "beyond cap"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate">
          {countsTotal === listN
            ? "Group counts match the list size."
            : `Note: group counts sum to ${countsTotal.toLocaleString()} but list size is ${listN.toLocaleString()} — update one to match for an accurate cap line.`}
        </p>
      </div>

      <p className="text-xs text-slate">
        Estimates for internal planning only — actual Twilio charges depend on carrier mix, message length,
        and reply volume; reconcile against the Twilio console and record spend as an FEC disbursement. This
        is educational information, not legal advice. Consult a campaign finance attorney or your filing
        agency for guidance specific to your situation.
      </p>
    </div>
  );
}
