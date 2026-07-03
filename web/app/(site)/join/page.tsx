import Link from "next/link";
import type { Metadata } from "next";
import { CAMPAIGN } from "@/lib/site";
import { JoinUpdatesForm } from "@/components/join/JoinUpdatesForm";
import { JoinPledgeForm } from "@/components/join/JoinPledgeForm";
import { JoinCta } from "@/components/join/JoinCta";
import { clerkEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Join the movement",
  description:
    "Four ways to join the campaign to restore public trust in MO-02: get updates, volunteer, pledge to give, or lead a team. Pick your level.",
  // The four entry points are ?door= variants of this same page. Declare /join as
  // the canonical so Google consolidates them instead of indexing near-duplicates.
  alternates: { canonical: "/join" },
};

type Door = {
  key: string;
  glyph: string;
  name: string;
  tagline: string;
  give: string;
  account: string;
  accent: string; // border/title accent
  // Static CTA (anchor) …
  cta?: string;
  href?: string;
  // … or an auth-aware CTA resolved client-side (volunteer / captain).
  auth?: { path: string; signedInLabel: string; signedOutLabel: string };
};

export default function JoinPage() {
  const doors: Door[] = [
    {
      key: "updates",
      glyph: "✉",
      name: "Get Updates",
      tagline: "Stay in the loop by email and text.",
      give: "Your email or phone",
      account: "No account needed",
      cta: "Keep me posted",
      href: "#updates",
      accent: "text-field",
    },
    {
      key: "volunteer",
      glyph: "✊",
      name: "Volunteer",
      tagline: "Give time — doors, calls, events, and more.",
      give: "A few hours + your skills",
      account: "Free account",
      auth: { path: "/join/volunteer", signedInLabel: "Build my profile", signedOutLabel: "Sign up to volunteer" },
      accent: "text-brick",
    },
    {
      key: "pledge",
      glyph: "◈",
      name: "Donor Pledge",
      tagline: "Commit to chip in before August 4.",
      give: "Dollars, via WinRed",
      account: "No account needed",
      cta: "Make my pledge",
      href: "#pledge",
      accent: "text-gold",
    },
    {
      key: "captain",
      glyph: "★",
      name: "Team Captain",
      tagline: "Recruit and lead a crew of volunteers.",
      give: "Leadership + ongoing time",
      account: "Account + quick review",
      auth: { path: "/join/captain", signedInLabel: "Apply to lead", signedOutLabel: "Sign up to lead" },
      accent: "text-ink",
    },
  ];

  // Comparison rows — what each level does / unlocks.
  const rows: { label: string; cells: [string, string, string, string] }[] = [
    { label: "What you do", cells: ["Follow along", "Do the work", "Fund the work", "Lead the work"] },
    { label: "Time", cells: ["None", "Flexible — 1 hr to weekly", "None", "Ongoing, 5+ hrs/wk"] },
    { label: "Account", cells: ["No", "Yes — free", "No", "Yes — free"] },
    { label: "We capture", cells: ["Contact + ZIP", "Skills, roles, availability", "Pledge intent", "All of Volunteer + why you lead"] },
    { label: "You get", cells: ["Email & SMS updates", "Matched to local action", "Donor thank-yous", "A team to lead + a captain playbook"] },
  ];

  return (
    <section className="container-page py-16 sm:py-20">
      <p className="eyebrow text-brick">Join the movement</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-5xl">
        Four ways to help win MO-02.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate">
        From staying informed to leading a team — pick the level that fits you. You can always do more later;
        every path adds to the same movement to restore public trust in Missouri&apos;s 2nd District.
      </p>

      {/* The menu of choices */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {doors.map((d) => (
          <div key={d.key} className="card flex flex-col p-6">
            <span className={`font-mono text-2xl ${d.accent}`} aria-hidden>
              {d.glyph}
            </span>
            <p className="mt-3 font-display text-lg font-semibold">{d.name}</p>
            <p className="mt-1 text-sm text-slate">{d.tagline}</p>
            <dl className="mt-4 space-y-1 text-xs text-slate">
              <div className="flex gap-1">
                <dt className="font-semibold text-ink">Give:</dt>
                <dd>{d.give}</dd>
              </div>
              <div className="flex gap-1">
                <dt className="font-semibold text-ink">Access:</dt>
                <dd>{d.account}</dd>
              </div>
            </dl>
            {d.auth ? (
              <JoinCta path={d.auth.path} signedInLabel={d.auth.signedInLabel} signedOutLabel={d.auth.signedOutLabel} clerkEnabled={clerkEnabled} />
            ) : d.href?.startsWith("#") ? (
              <a href={d.href} className="btn-primary mt-5 text-center">
                {d.cta}
              </a>
            ) : (
              <Link href={d.href ?? "#"} className="btn-primary mt-5 text-center">
                {d.cta}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Comparison chart — full detail, desktop */}
      <div className="mt-12 hidden overflow-hidden rounded-sm border border-line lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper">
            <tr>
              <th className="px-4 py-3 font-semibold text-ink">Compare</th>
              {doors.map((d) => (
                <th key={d.key} className="px-4 py-3 font-display font-semibold text-ink">
                  {d.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <th scope="row" className="px-4 py-3 font-semibold text-slate">
                  {r.label}
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className="px-4 py-3 text-ink">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inline: Get Updates */}
      <div id="updates" className="mt-16 scroll-mt-24">
        <p className="eyebrow text-field">Get Updates</p>
        <h2 className="mt-2 text-2xl font-semibold">Stay in the loop.</h2>
        <p className="mt-1 max-w-prose text-sm text-slate">
          The fastest way in — we&apos;ll send you the case for change, events near you, and how to help.
        </p>
        <div className="mt-5 max-w-2xl rounded-sm border border-line bg-paper p-6">
          <JoinUpdatesForm />
        </div>
      </div>

      {/* Inline: Donor Pledge */}
      <div id="pledge" className="mt-16 scroll-mt-24">
        <p className="eyebrow text-gold">Donor Pledge</p>
        <h2 className="mt-2 text-2xl font-semibold">Pledge to chip in.</h2>
        <p className="mt-1 max-w-prose text-sm text-slate">
          Tell us you&apos;re in, then complete your gift on WinRed. Every dollar funds doors, calls, and mail
          before {CAMPAIGN.electionLabel}.
        </p>
        <div className="mt-5 max-w-2xl rounded-sm border border-line bg-paper p-6">
          <JoinPledgeForm />
        </div>
      </div>

      <p className="mt-14 text-xs text-slate">{CAMPAIGN.paidForBy}</p>
    </section>
  );
}
