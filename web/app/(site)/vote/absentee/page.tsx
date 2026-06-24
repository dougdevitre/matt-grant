import type { Metadata } from "next";
import Link from "next/link";
import { CAMPAIGN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Vote Absentee — August 4, 2026 Primary",
  description:
    "Your step-by-step guide to voting early or absentee in Missouri's 2nd District primary on August 4, 2026 — every option, every deadline, every step.",
};

// Official sources — we link out for the authoritative rules; the campaign
// provides the plain-language walkthrough. Confirm dates and sites there.
const SOS_GOVOTE = "https://www.sos.mo.gov/elections/govotemissouri"; // the Missouri voting-rules page
const SOS_HOME = "https://www.sos.mo.gov";
const STL_COUNTY = "https://www.stlouiscountymovotes.gov";
const STC_COUNTY = "https://www.sccmo.org";

const DATES = [
  { what: "Register to vote", when: "Wed, July 8, 2026" },
  { what: "Excuse-based absentee opens", when: "~June 23, 2026 (open now)" },
  { what: "By-mail application must be RECEIVED", when: "5:00 p.m. Wed, July 22, 2026" },
  { what: "No-excuse early in-person voting", when: "~July 21 – Aug 3, 2026" },
  { what: "Voted ballot must be RECEIVED", when: "7:00 p.m. Tue, Aug 4, 2026" },
  { what: "Election Day (polls 6 a.m.–7 p.m.)", when: "Tue, Aug 4, 2026" },
];

const REASONS = [
  "You'll be absent from your county",
  "Illness or disability — yours, or someone you care for at your address",
  "Religious belief or practice",
  "Election work, first responder, health care worker, or law enforcement",
  "Incarceration (with voting rights retained)",
  "Certified Safe at Home (address confidentiality) participant",
];

export default function AbsenteePage() {
  return (
    <section className="container-page py-16 sm:py-20">
      <p className="eyebrow text-brick">Get out the vote</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-5xl">
        Vote absentee for the August 4 primary.
      </h1>
      <p className="mt-5 max-w-prose text-lg text-slate">
        You don&apos;t have to wait for Election Day. Missouri makes it easy to vote early — and the
        easiest way to make sure your voice is heard is to make a plan now. Here&apos;s every option,
        every deadline, and every step so your ballot <strong className="text-ink">counts</strong>.
      </p>

      <div className="mt-6 rounded-lg border border-line bg-white p-5 text-sm text-slate shadow-card">
        <p>
          <strong className="text-ink">To vote in the Republican primary, request the Republican
          ballot.</strong>{" "}
          Missouri&apos;s August primary is partisan — you choose one party&apos;s ballot for this
          election only. It does not change your registration.
        </p>
        <p className="mt-3">
          Dates, deadlines, and sites below reflect Missouri law and the St. Louis County and St.
          Charles County election authorities — rules can change, so always confirm with your
          election authority or the{" "}
          <a className="underline" href={SOS_GOVOTE} target="_blank" rel="noopener noreferrer">
            Missouri Secretary of State
          </a>{" "}
          before you rely on a date.
        </p>
      </div>

      {/* Dates */}
      <h2 className="mt-12 font-display text-2xl font-semibold text-ink">The dates that matter</h2>
      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-ink">
              <th className="px-4 py-3 font-semibold">What</th>
              <th className="px-4 py-3 font-semibold">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {DATES.map((d) => (
              <tr key={d.what} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-slate">{d.what}</td>
                <td className="px-4 py-3 font-medium text-ink">{d.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-prose text-sm text-slate">
        ⚠️ Mailed ballots count by <strong className="text-ink">receipt, not postmark</strong>. Mail
        it about a week early or hand-deliver it. Missouri does not allow ballot drop boxes.
      </p>

      {/* Options */}
      <h2 className="mt-12 font-display text-2xl font-semibold text-ink">Pick the option that fits you</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <div className="card flex flex-col p-6">
          <h3 className="font-display text-lg font-semibold text-ink">1 — Vote early, in person</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brick">Easiest — no reason, no notary</p>
          <p className="mt-3 flex-1 text-sm text-slate">
            The simplest path for most people. <strong className="text-ink">~July 21 – Aug 3</strong>{" "}
            (ends 5 p.m. Mon, Aug 3). Bring a valid photo ID — that&apos;s it. No application, no
            excuse, no notary. Walk in, vote, done.
          </p>
        </div>
        <div className="card flex flex-col p-6">
          <h3 className="font-display text-lg font-semibold text-ink">2 — Absentee by mail</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brick">Needs a reason</p>
          <p className="mt-3 flex-1 text-sm text-slate">
            Apply by <strong className="text-ink">5 p.m. Wed, July 22</strong>. Your ballot arrives by
            mail. For reasons #1, #3, and #4 the return envelope must be notarized (it&apos;s free) —
            don&apos;t sign until you&apos;re in front of the notary. Return so it{" "}
            <strong className="text-ink">arrives by 7 p.m. Aug 4</strong>.
          </p>
        </div>
        <div className="card flex flex-col p-6">
          <h3 className="font-display text-lg font-semibold text-ink">3 — Absentee in person</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brick">A clerk witnesses — no notary</p>
          <p className="mt-3 flex-1 text-sm text-slate">
            Same six reasons as Option 2, but you vote in person at the Board of Elections, so a clerk
            witnesses it and no notary is needed. Open from about six weeks before the election through
            the day before.
          </p>
        </div>
      </div>

      {/* Reasons */}
      <h2 className="mt-12 font-display text-2xl font-semibold text-ink">Do you qualify to vote by mail?</h2>
      <p className="mt-3 max-w-prose text-sm text-slate">
        You qualify if <strong className="text-ink">one</strong> of these is true on Election Day:
      </p>
      <ol className="mt-4 max-w-prose list-decimal space-y-2 pl-6 text-sm text-slate">
        {REASONS.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p className="mt-4 max-w-prose text-sm text-slate">
        <strong className="text-ink">Notary check:</strong> reasons #1, #3, and #4 require a notarized
        return envelope (free — banks, libraries, and credit unions often do it). Reasons #2 and #6 are
        notary-exempt. If you&apos;d rather skip the notary entirely, vote no-excuse in person (July
        21–Aug 3) instead — but if you do, don&apos;t also return a mailed ballot. Vote once, one way.
      </p>

      {/* After submit */}
      <h2 className="mt-12 font-display text-2xl font-semibold text-ink">After you apply — don&apos;t stop here</h2>
      <p className="mt-3 max-w-prose text-sm text-slate">
        Submitting the application is not the same as voting. Here&apos;s the full arc:
      </p>
      <ol className="mt-4 max-w-prose list-decimal space-y-2 pl-6 text-sm text-slate">
        <li>The election authority mails your ballot.</li>
        <li>You mark it.</li>
        <li>You notarize the return envelope if your reason requires it.</li>
        <li>You return it so it arrives by 7 p.m. on Aug 4.</li>
      </ol>

      {/* Photo ID */}
      <h2 className="mt-12 font-display text-2xl font-semibold text-ink">Acceptable photo ID</h2>
      <ul className="mt-4 max-w-prose list-disc space-y-2 pl-6 text-sm text-slate">
        <li>Non-expired Missouri driver&apos;s or non-driver license</li>
        <li>U.S. passport</li>
        <li>Military or veteran ID</li>
        <li>Other U.S. or Missouri government photo ID (not expired, or expired after 11/5/2024)</li>
        <li>
          No ID? Get a <strong className="text-ink">free non-driver ID</strong> — call{" "}
          <a className="underline" href="tel:+15735268683">573-526-8683</a>.
        </li>
      </ul>

      {/* Election authorities */}
      <h2 className="mt-12 font-display text-2xl font-semibold text-ink">Your election authority</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="card p-6 text-sm text-slate">
          <p className="font-display text-base font-semibold text-ink">St. Louis County Board of Elections</p>
          <p className="mt-2">725 Northwest Plaza Dr, St. Ann, MO 63074</p>
          <p className="mt-1">
            <a className="underline" href="tel:+13146151833">314.615.1833</a> / RelayMO 711
          </p>
          <p className="mt-1">
            <a className="underline" href="mailto:boecabsentee@stlouiscountymo.gov">boecabsentee@stlouiscountymo.gov</a>
          </p>
          <p className="mt-1">
            <a className="underline" href={STL_COUNTY} target="_blank" rel="noopener noreferrer">stlouiscountymovotes.gov</a>
          </p>
        </div>
        <div className="card p-6 text-sm text-slate">
          <p className="font-display text-base font-semibold text-ink">St. Charles County Election Authority</p>
          <p className="mt-2">397 Turner Blvd, St. Peters, MO 63376</p>
          <p className="mt-1">
            <a className="underline" href={STC_COUNTY} target="_blank" rel="noopener noreferrer">sccmo.org</a>{" "}
            (search &ldquo;Absentee Voting&rdquo;)
          </p>
        </div>
      </div>
      <p className="mt-4 max-w-prose text-sm text-slate">
        Not sure which county you&apos;re in? Check your registration and find your local election
        authority at{" "}
        <a className="underline" href={SOS_HOME} target="_blank" rel="noopener noreferrer">sos.mo.gov</a>.
      </p>

      {/* CTAs */}
      <div className="mt-12 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-6 shadow-card">
        <p className="mr-auto font-display text-lg font-semibold text-ink">Every vote for Matt Grant starts with a plan.</p>
        <a href={SOS_GOVOTE} target="_blank" rel="noopener noreferrer" className="btn-primary">Missouri voting rules &amp; absentee →</a>
        <Link href="/vote" className="btn-ghost">Back to Make your plan to vote</Link>
      </div>

      <p className="mt-8 max-w-prose text-xs text-slate">
        This is educational voting information based on Missouri law and the St. Louis County and St.
        Charles County election authorities. Rules can change — always confirm with your election
        authority. The voting process applies to all voters regardless of candidate preference. For
        the official Missouri voting rules, see{" "}
        <a className="underline" href={SOS_GOVOTE} target="_blank" rel="noopener noreferrer">sos.mo.gov</a>.{" "}
        {CAMPAIGN.paidForBy}
      </p>
    </section>
  );
}
