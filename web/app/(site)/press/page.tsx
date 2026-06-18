import type { Metadata } from "next";
import { CAMPAIGN } from "@/lib/site";
import { PressKit } from "@/components/PressKit";

export const metadata: Metadata = {
  title: "Press",
  description: "Press coverage, media inquiries, and primary sources for Matt Grant for Congress.",
};

type Item = { outlet: string; date: string; title: string; href: string; desc: string };

// Coverage of the pending federal civil RICO / civil-rights lawsuit. All items
// are allegations in a case that has not been adjudicated — keep "alleges /
// claims" framing. Links provided by the campaign; verify before publicizing.
const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "News media",
    items: [
      {
        outlet: "NTD News",
        date: "January 8, 2026",
        title: "St. Louis Dad Alleges ‘Buying Future Litigation’ Court Scheme",
        href: "https://www.ntd.com/st-louis-dad-alleges-buying-future-litigation-court-scheme_1118259.html",
        desc: "Follow-up report on the amended complaint and the case’s status before the federal court.",
      },
      {
        outlet: "KSDK — 5 On Your Side (NBC)",
        date: "September 8, 2025",
        title: "Community members rally over concerns at St. Louis County Family Court",
        href: "https://www.ksdk.com/article/news/community-members-rally-over-st-louis-county-family-court-concerns/63-ad3ed7b9-b535-4a6c-b99e-368a744c5817",
        desc: "Local NBC affiliate coverage of a public rally calling for family court reform, referencing the lawsuit.",
      },
      {
        outlet: "NTD News",
        date: "August 15, 2025",
        title: "St. Louis Father Sues Missouri Family Court Insiders",
        href: "https://www.ntd.com/st-louis-dad-sues-missouri-family-court-insiders_1084761.html",
        desc: "National outlet report on the filing of the federal RICO and civil-rights lawsuit.",
      },
      {
        outlet: "Legal Newsline / St. Louis Record",
        date: "August 14, 2025",
        title: "Attorney files RICO, civil rights suit against St. Louis Family Court",
        href: "https://www.legalnewsline.com/stlouis-record/attorney-files-rico-civil-rights-suit-against-st-louis-family-court/article_3968fdae-167c-49f7-8221-a509f0a5a019.html",
        desc: "Legal-trade coverage of the complaint and its RICO and civil-rights claims.",
      },
    ],
  },
  {
    label: "Independent journalism & podcasts",
    items: [
      {
        outlet: "The Unknown Podcast — Michael Volpe",
        date: "September 10, 2025",
        title: "Episode 55: Federal judge takes a flamethrower to the civil RICO lawsuit",
        href: "https://michaelvolpe.substack.com/p/the-unknown-episode-55-federal-judge",
        desc: "Investigative podcast discussing the case and the federal court’s show-cause order.",
      },
      {
        outlet: "The Family Court Circus",
        date: "September 5, 2025",
        title: "RICO Falters Against Missouri Family Court",
        href: "https://thefamilycourtcircus.com/2025/09/05/matt-grants-rico-falters/",
        desc: "Coverage of the federal court’s order requiring the complaint to be narrowed or amended.",
      },
      {
        outlet: "The Family Court Circus",
        date: "August 23, 2025",
        title: "War on Missouri Family Court Corruption",
        href: "https://thefamilycourtcircus.com/2025/08/23/matt-grants-war/",
        desc: "Feature on the lawsuit and the claims it raises about the St. Louis County family court.",
      },
      {
        outlet: "Richard Luthmann (Substack)",
        date: "August 23, 2025",
        title: "War on Missouri Family Court Corruption",
        href: "https://luthmann.substack.com/p/matt-grants-war-on-missouri-family",
        desc: "Independent commentary and syndication of the case coverage.",
      },
    ],
  },
  {
    label: "Primary sources",
    items: [
      {
        outlet: "Court filing",
        date: "August 2025",
        title: "Complaint — Grant et al. v. Hilton et al. (E.D. Mo.)",
        href: "https://www.scribd.com/document/901357282/RICO-lawsuit-against-family-court-in-St-Louis-County-MO",
        desc: "Full text of the civil RICO and civil-rights complaint as filed.",
      },
      {
        outlet: "Press release — PRLog",
        date: "2025",
        title:
          "Whistleblower Attorney Matthew Grant Challenges Corruption in Family Courts with RICO Filing in Federal Court",
        href: "https://www.prlog.org/13118162-whistleblower-attorney-matthew-grant-challenges-corruption-in-family-courts-with-rico-filing-in-federal-court.html",
        desc: "The campaign’s announcement of the federal filing.",
      },
      {
        outlet: "StopMissouriCorruption.com",
        date: "Ongoing",
        title: "Stop Missouri Corruption — official site",
        href: "https://stopmissouricorruption.com/",
        desc: "Case background, filings, and updates published directly by Matthew R. Grant.",
      },
    ],
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

      <PressKit />

      <h2 className="mt-16 font-display text-2xl font-semibold sm:text-3xl">In the news</h2>
      <p className="mt-3 max-w-prose text-slate">
        Selected coverage of the federal civil RICO and civil-rights lawsuit filed in the U.S.
        District Court for the Eastern District of Missouri, which alleges systemic corruption in the
        St. Louis County family court. The case is <span className="text-ink">pending</span>; the
        descriptions below summarize reporting and do not represent findings of fact.
      </p>

      {GROUPS.map((g) => (
        <div key={g.label} className="mt-12">
          <p className="eyebrow border-b border-ink pb-2 text-ink">{g.label}</p>
          <ul className="divide-y divide-line">
            {g.items.map((it) => (
              <li key={it.href} className="py-6">
                <a
                  href={it.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group grid gap-2 sm:grid-cols-[12rem_1fr] sm:gap-8"
                >
                  <span className="border-l-2 border-gold pl-3">
                    <span className="block font-display text-sm font-semibold text-ink">{it.outlet}</span>
                    <span className="mt-0.5 block font-mono text-xs uppercase tracking-eyebrow text-slate">
                      {it.date}
                    </span>
                  </span>
                  <span>
                    <span className="font-display text-xl font-semibold text-ink group-hover:text-brick">
                      {it.title}
                      <span className="ml-2 text-slate group-hover:text-brick">↗</span>
                    </span>
                    <span className="mt-1 block max-w-prose text-sm text-slate">{it.desc}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="mt-10 max-w-prose border-t border-line pt-5 text-xs text-slate">
        Coverage compiled from publicly available sources; outlets and dates as reported. All matters
        described are allegations in a pending lawsuit and have not been adjudicated.
      </p>

      <div className="card mt-12 flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow text-slate">Media inquiries</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Working on a story?</h2>
          <p className="mt-1 text-slate">Reach the campaign and we&apos;ll get back to you quickly.</p>
        </div>
        <a href={`mailto:${CAMPAIGN.email}?subject=Media%20Inquiry`} className="btn-ink whitespace-nowrap">
          Email the campaign
        </a>
      </div>
    </section>
  );
}
