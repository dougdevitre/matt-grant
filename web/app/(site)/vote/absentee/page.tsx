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

// MO-02 (2025 enacted map) = the St. Louis County portion of the district plus
// Franklin, Jefferson, Washington, Crawford, and Gasconade counties (Franklin is
// in MO-02 per the official voter file — see candidate/absentee-voting-guide.md).
// St. Charles is NOT in MO-02. County election-authority contacts verified
// 2026-07-03 against the official county sites (Franklin verified 2026-07-10).
// Each rural county's election authority is its County Clerk.
const AUTHORITIES = [
  {
    name: "St. Louis County Board of Elections",
    lines: ["725 Northwest Plaza Dr, St. Ann, MO 63074"],
    tel: "+13146151833",
    telLabel: "314.615.1833 / RelayMO 711",
    email: "boecabsentee@stlouiscountymo.gov",
    site: "https://www.stlouiscountymovotes.gov",
    siteLabel: "stlouiscountymovotes.gov",
  },
  {
    name: "Franklin County Clerk (Election Authority)",
    lines: ["400 E Locust, Room 201, Union, MO 63084"],
    tel: "+16365836355",
    telLabel: "636.583.6355",
    site: "https://www.franklinmo.org",
    siteLabel: "franklinmo.org",
  },
  {
    name: "Jefferson County Clerk (Election Authority)",
    lines: ["729 Maple St, Suite G17, Hillsboro, MO 63050", "Mail: P.O. Box 100, Hillsboro, MO 63050"],
    tel: "+16367975486",
    telLabel: "636.797.5486",
    site: "https://www.jeffcomo.org",
    siteLabel: "jeffcomo.gov",
  },
  {
    name: "Washington County Clerk",
    lines: ["102 N Missouri St, Potosi, MO 63664"],
    tel: "+15734367704",
    telLabel: "573.436.7704",
    site: "https://www.washcoclerkmo.gov",
    siteLabel: "washcoclerkmo.gov",
  },
  {
    name: "Crawford County Clerk",
    lines: ["302 W Main St, #AS, Steelville, MO 65565"],
    tel: "+15737752376",
    telLabel: "573.775.2376",
    site: "https://crawfordcountymo.net",
    siteLabel: "crawfordcountymo.net",
  },
  {
    name: "Gasconade County Clerk (Election Authority)",
    lines: ["119 E First St, Suite 2, Hermann, MO 65041"],
    tel: "+15734865427",
    telLabel: "573.486.5427",
    site: "https://gasconadecounty.org",
    siteLabel: "gasconadecounty.org",
  },
];
// Printable official SOS request form (served from /public) + St. Louis County
// Library mobile printing, for voters who can't complete the application online.
const FORM_PDF = "/absentee-ballot-request-form.pdf";
const LIBRARY_PRINT = "https://mobileprint.slcl.org/myprintcenter";

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
          Dates, deadlines, and sites below reflect Missouri law and the MO-02 county election
          authorities — the St. Louis County portion of the district plus Franklin, Jefferson,
          Washington, Crawford, and Gasconade counties. Rules can change, so always confirm with your county
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
        <strong className="text-ink">Notary check:</strong> reasons #2 (illness/disability), #5
        (incarceration), and #6 (Safe at Home) are notary-exempt — as are permanently disabled and
        covered military/overseas voters. Reasons #1, #3, and #4 generally require a notarized return
        envelope (free — banks, libraries, and credit unions often do it). Notary rules have specific
        exemptions and have changed in recent years, so confirm your situation with your county
        election authority. If you&apos;d rather skip the notary entirely, vote no-excuse in person
        (July 21–Aug 3) instead — but if you do, don&apos;t also return a mailed ballot. Vote once, one
        way.
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

      {/* Prefer paper / printable form */}
      <h2 className="mt-12 font-display text-2xl font-semibold text-ink">Prefer paper? Print the request form</h2>
      <p className="mt-3 max-w-prose text-sm text-slate">
        You can apply online, but if you&apos;d rather fill it out by hand, print the official Missouri
        Secretary of State <strong className="text-ink">Request for Missouri Absentee Ballot</strong> form,
        complete it, and mail or hand-deliver it to your election authority so it arrives by{" "}
        <strong className="text-ink">5 p.m. Wed, July 22</strong>.
      </p>
      <div className="mt-4 rounded-lg border border-line bg-white p-6 shadow-card">
        <a href={FORM_PDF} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Download the request form (PDF) →
        </a>
        <p className="mt-4 text-sm text-slate">
          <strong className="text-ink">No printer? Print it at any St. Louis County Library.</strong>{" "}
          Use the library&apos;s mobile printing — cardholders get $5 in printing free each month, and
          it works at every branch:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm text-slate">
          <li>
            Save the PDF, then open the library print center at{" "}
            <a className="underline" href={LIBRARY_PRINT} target="_blank" rel="noopener noreferrer">
              mobileprint.slcl.org/myprintcenter
            </a>.
          </li>
          <li>Upload the form and submit it to the print queue.</li>
          <li>
            Release and pick it up at the print station in any St. Louis County Library branch (sign in
            with your library card, or ask staff for help).
          </li>
          <li>Fill it out, sign it, and mail or hand-deliver it to your election authority by the July 22 deadline.</li>
        </ol>
      </div>

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
      <p className="mt-3 max-w-prose text-sm text-slate">
        Find the one for <strong className="text-ink">your</strong> county — MO-02 (2025 map) spans the
        St. Louis County portion of the district plus Franklin, Jefferson, Washington, Crawford, and
        Gasconade counties.
      </p>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {AUTHORITIES.map((a) => (
          <div key={a.name} className="card p-6 text-sm text-slate">
            <p className="font-display text-base font-semibold text-ink">{a.name}</p>
            {a.lines.map((l) => (
              <p key={l} className="mt-2">{l}</p>
            ))}
            <p className="mt-1">
              <a className="underline" href={`tel:${a.tel}`}>{a.telLabel}</a>
            </p>
            {a.email && (
              <p className="mt-1">
                <a className="underline" href={`mailto:${a.email}`}>{a.email}</a>
              </p>
            )}
            <p className="mt-1">
              <a className="underline" href={a.site} target="_blank" rel="noopener noreferrer">{a.siteLabel}</a>
            </p>
          </div>
        ))}
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
        This is educational voting information based on Missouri law and the MO-02 county election
        authorities (St. Louis, Franklin, Jefferson, Washington, Crawford, and Gasconade counties). Rules can
        change — always confirm with your election authority. The voting process applies to all voters
        regardless of candidate preference. For
        the official Missouri voting rules, see{" "}
        <a className="underline" href={SOS_GOVOTE} target="_blank" rel="noopener noreferrer">sos.mo.gov</a>.{" "}
        {CAMPAIGN.paidForBy}
      </p>
    </section>
  );
}
