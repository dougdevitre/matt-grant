import type { Metadata } from "next";
import Link from "next/link";
import { CAMPAIGN, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Make Your Plan to Vote",
  description:
    "Missouri's 2nd District primary is Tuesday, August 4, 2026. Register, find your polling place, and make your plan to vote.",
};

// Official Missouri Secretary of State tools (sos.mo.gov) — we link out, we
// don't reproduce the rules, so voter info stays accurate and current.
const SOS_REGISTER = "https://www.sos.mo.gov/elections/govotemissouri/register";
const SOS_LOOKUP = "https://s1.sos.mo.gov/elections/voterlookup/";
const SOS_GOVOTE = "https://www.sos.mo.gov/elections/govotemissouri";
const CAL_URL =
  "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" +
  encodeURIComponent("Vote — MO-02 Primary") +
  "&dates=20260804/20260805&details=" +
  encodeURIComponent(`Polls are open in Missouri's 2nd District. Find your polling place: ${SOS_LOOKUP}`);
const SHARE_TEXT = encodeURIComponent("Missouri's 2nd District primary is August 4. Make your plan to vote:");
const VOTE_URL = `${SITE_URL}/vote`;

type Step = {
  n: string;
  title: string;
  body: string;
  cta: { label: string; href: string; internal: boolean };
  secondary: { label: string; href: string } | null;
};

const STEPS: Step[] = [
  {
    n: "1",
    title: "Register or check your registration",
    body: "New to your address, or not sure you're registered? Missouri's registration deadline is the 4th Wednesday before the election — about July 8, 2026. Confirm at the official link.",
    cta: { label: "Register / check status", href: SOS_REGISTER, internal: false },
    secondary: null,
  },
  {
    n: "2",
    title: "Find your polling place",
    body: "See exactly where to vote and what's on your ballot for the August 4 primary, straight from the Secretary of State.",
    cta: { label: "Look up my polling place", href: SOS_LOOKUP, internal: false },
    secondary: null,
  },
  {
    n: "3",
    title: "Vote early or absentee",
    body: "Can't make it on Election Day? Missouri offers no-excuse early in-person voting and absentee by mail. Our step-by-step guide walks you through every option, deadline, and step.",
    cta: { label: "Absentee & early voting", href: "/vote/absentee", internal: true },
    secondary: { label: "Official Missouri voting rules", href: SOS_GOVOTE },
  },
];

export default function VotePage() {
  return (
    <section className="container-page py-16 sm:py-20">
      <p className="eyebrow text-brick">Get out the vote</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">Make your plan to vote.</h1>
      <p className="mt-5 max-w-prose text-lg text-slate">
        Missouri&apos;s 2nd District primary is <strong className="text-ink">Tuesday, August&nbsp;4, 2026</strong>. This race
        will be decided by who shows up. Three quick steps to make sure that&apos;s you.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="card flex flex-col p-6">
            <span className="grid h-9 w-9 place-items-center rounded-sm bg-ink font-display text-lg font-semibold text-paper">{s.n}</span>
            <h2 className="mt-4 font-display text-xl font-semibold text-ink">{s.title}</h2>
            <p className="mt-2 flex-1 text-sm text-slate">{s.body}</p>
            {s.cta.internal ? (
              <Link href={s.cta.href} className="btn-primary mt-5 text-center">
                {s.cta.label} →
              </Link>
            ) : (
              <a href={s.cta.href} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5 text-center">
                {s.cta.label} →
              </a>
            )}
            {s.secondary && (
              <a href={s.secondary.href} target="_blank" rel="noopener noreferrer" className="mt-3 text-center text-xs text-slate underline">
                {s.secondary.label} →
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-6 shadow-card">
        <p className="mr-auto font-display text-lg font-semibold text-ink">Lock it in — add Election Day to your calendar.</p>
        <a href={CAL_URL} target="_blank" rel="noopener noreferrer" className="btn-ink">Add to calendar</a>
        <a href={`https://twitter.com/intent/tweet?text=${SHARE_TEXT}&url=${encodeURIComponent(VOTE_URL)}`} target="_blank" rel="noopener noreferrer" className="btn-ghost">Share on X</a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(VOTE_URL)}`} target="_blank" rel="noopener noreferrer" className="btn-ghost">Share on Facebook</a>
      </div>

      <p className="mt-8 max-w-prose text-xs text-slate">
        Voter information comes from the Missouri Secretary of State —{" "}
        <a className="underline" href={SOS_GOVOTE} target="_blank" rel="noopener noreferrer">sos.mo.gov</a>. Dates and rules
        are theirs; confirm details there. {CAMPAIGN.paidForBy}
      </p>
    </section>
  );
}
