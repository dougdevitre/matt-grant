import type { Metadata } from "next";
import { CAMPAIGN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Press",
  description: "Press releases and media inquiries for Matt Grant for Congress.",
};

const RELEASES = [
  {
    date: "2025",
    title:
      "Whistleblower Attorney Matthew Grant Challenges Corruption in Family Courts with RICO Filing in Federal Court",
    href: "https://www.prlog.org/13118162-whistleblower-attorney-matthew-grant-challenges-corruption-in-family-courts-with-rico-filing-in-federal-court.html",
  },
];

export default function PressPage() {
  return (
    <section className="container-page py-16 sm:py-24">
      <p className="eyebrow text-brick">Newsroom</p>
      <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Press &amp; media.</h1>
      <p className="mt-5 max-w-prose text-lg text-slate">
        Official statements and press releases from the campaign. For interviews and media
        inquiries, contact us directly.
      </p>

      <ul className="mt-12 divide-y divide-line border-y border-line">
        {RELEASES.map((r) => (
          <li key={r.href} className="py-6">
            <a
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group grid gap-2 sm:grid-cols-[8rem_1fr] sm:gap-8"
            >
              <span className="font-mono text-xs uppercase tracking-eyebrow text-gold">{r.date}</span>
              <span className="font-display text-xl font-semibold text-ink group-hover:text-brick">
                {r.title}
                <span className="ml-2 text-slate group-hover:text-brick">↗</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className="card mt-12 flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow text-slate">Media inquiries</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Working on a story?</h2>
          <p className="mt-1 text-slate">Reach the campaign and we'll get back to you quickly.</p>
        </div>
        <a href={`mailto:${CAMPAIGN.email}?subject=Media%20Inquiry`} className="btn-ink whitespace-nowrap">
          Email the campaign
        </a>
      </div>
    </section>
  );
}
