import type { Metadata } from "next";
import Link from "next/link";
import { CAMPAIGN, PRIORITIES, VALUES } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Matt / Issues",
  description:
    "Matt Grant's story and where he stands: ending family-court corruption, term limits, a smaller government, and lower taxes for Missouri's 2nd District.",
};

const CAREER = [
  {
    org: "Husch Blackwell LLP",
    role: "Equity Partner — Litigation",
    span: "21 years",
    note: "Built and led teams that delivered efficient results for Missouri's families and businesses.",
  },
  {
    org: "Thompson Coburn LLP",
    role: "Litigation Associate Attorney",
    span: "2 years",
    note: "Began a courtroom career grounded in preparation, integrity, and hard work.",
  },
  {
    org: "Boy Scouts of America",
    role: "Eagle Scout",
    span: "Early years",
    note: "Where Matt first learned the value of public service and community.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="container-page py-16 sm:py-20">
          <p className="eyebrow text-brick">About Matt</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">
            A neighbor, a dad, and a problem-solver.
          </h1>
          <p className="mt-6 max-w-prose text-lg text-slate">
            Matt Grant has spent his life bringing people together to get results. From three public
            schools to a legal career and now public service, he learned the value of hard work,
            integrity, and community — and he's running for Congress to make sure every child in
            Missouri's 2nd District has a fair shot.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {VALUES.map((v) => (
              <span key={v} className="rounded-sm border border-line px-3 py-1 font-mono text-xs uppercase tracking-eyebrow text-field">
                {v}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Career ledger */}
      <section className="container-page py-16 sm:py-20">
        <p className="eyebrow text-slate">Education &amp; service</p>
        <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">The work behind the candidate.</h2>
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {CAREER.map((c) => (
            <li key={c.org} className="grid gap-2 py-6 sm:grid-cols-[1fr_2fr] sm:gap-8">
              <div>
                <p className="font-display text-xl font-semibold text-ink">{c.org}</p>
                <p className="font-mono text-xs uppercase tracking-eyebrow text-gold">{c.span}</p>
              </div>
              <div>
                <p className="font-semibold text-ink">{c.role}</p>
                <p className="mt-1 text-slate">{c.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Issues — full */}
      <section id="issues" className="bg-ink text-paper">
        <div className="container-page py-16 sm:py-24">
          <p className="eyebrow text-gold">The issues</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-5xl">
            Where Matt stands.
          </h2>
          <p className="mt-4 max-w-prose text-lg text-paper/75">
            Four priorities, each one concrete and accountable.
          </p>

          <div className="mt-12 space-y-px overflow-hidden rounded-lg bg-paper/10">
            {PRIORITIES.map((p) => (
              <article key={p.id} className="bg-ink p-8">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-sm text-gold">{p.n}</span>
                  <h3 className="font-display text-2xl font-semibold sm:text-3xl">{p.title}</h3>
                </div>
                <p className="mt-4 max-w-prose text-paper/80">{p.summary}</p>
              </article>
            ))}
          </div>

          <div className="card mt-10 border-gold/30 bg-field/30 p-8">
            <p className="eyebrow text-gold">Signature legislation</p>
            <h3 className="mt-2 font-display text-2xl font-semibold">The CHILD Protection Act of 2027</h3>
            <p className="mt-3 max-w-prose text-paper/80">
              <strong className="text-paper">CHILD</strong> — Corruption Hiding Inside Legal Dockets.
              Matt's proposal calls for federal oversight that ties Title IV-D grant money to states
              that keep their family courts clean and accountable to the children they serve.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-16 text-center sm:py-20">
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold sm:text-4xl">
          Like where Matt stands? Help put him in Congress.
        </h2>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href={CAMPAIGN.donateUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Donate now
          </a>
          <Link href="/contact" className="btn-ink">Volunteer</Link>
        </div>
      </section>
    </>
  );
}
