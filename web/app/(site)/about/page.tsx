import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CAMPAIGN, VALUES, ASSETS_CDN } from "@/lib/site";
import { ISSUES } from "@/lib/issues";
import { CtaButton } from "@/components/CtaButton";

export const metadata: Metadata = {
  title: "About Matt",
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
        <div className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow text-brick">About Matt</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">
              A neighbor, a dad, and a problem-solver.
            </h1>
            <p className="mt-6 max-w-prose text-lg text-slate">
              Matt Grant has spent his life bringing people together to get results. From three public
              schools to a legal career and now public service, he learned the value of hard work,
              integrity, and community — and he&apos;s running for Congress to make sure every child in
              Missouri&apos;s 2nd District has a fair shot.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {VALUES.map((v) => (
                <span key={v} className="rounded-sm border border-line px-3 py-1 font-mono text-xs uppercase tracking-eyebrow text-field">
                  {v}
                </span>
              ))}
            </div>
          </div>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-lg border border-line shadow-card lg:max-w-none">
            <Image
              src="/brand/portrait-800.png"
              alt="Matt Grant"
              fill
              sizes="(max-width: 1024px) 80vw, 33vw"
              className="object-cover"
              priority
            />
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

      {/* Decorative district divider — bridges the white section into the dark one */}
      <div className="relative h-44 w-full overflow-hidden bg-ink sm:h-60">
        <Image
          src={`${ASSETS_CDN}/public/web/st-louis-arch.png`}
          alt=""
          fill
          sizes="100vw"
          aria-hidden
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-ink/25 to-ink" aria-hidden />
      </div>

      {/* Issues — teaser (full content lives at /issues) */}
      <section id="issues" className="bg-ink text-paper">
        <div className="container-page py-16 sm:py-24">
          <p className="eyebrow text-goldlight">The issues</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-5xl">Where Matt stands.</h2>
          <p className="mt-4 max-w-prose text-lg text-paper/75">
            Four fights worth winning — each with Matt&apos;s argument, his commitment, and a short video.
          </p>

          <div className="mt-10 grid gap-px overflow-hidden rounded-lg bg-paper/10 sm:grid-cols-2">
            {ISSUES.map((issue) => (
              <Link key={issue.slug} href={`/issues/${issue.slug}`} className="group bg-ink p-8 transition-colors hover:bg-field/30">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-sm text-goldlight">{issue.n}</span>
                  <h3 className="font-display text-xl font-semibold sm:text-2xl group-hover:text-goldlight">{issue.title}</h3>
                </div>
                <p className="mt-3 text-paper/75">{issue.tagline}</p>
                <span className="mt-4 inline-block font-mono text-xs uppercase tracking-eyebrow text-goldlight">Open issue →</span>
              </Link>
            ))}
          </div>

          <Link href="/issues" className="btn-gold mt-8 inline-block">Explore all four issues</Link>
        </div>
      </section>

      <section className="container-page py-16 text-center sm:py-20">
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold sm:text-4xl">
          Like where Matt stands? Help put him in Congress.
        </h2>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <CtaButton href={CAMPAIGN.donateUrl} external context="donate">
            Donate now
          </CtaButton>
          <Link href="/contact" className="btn-ink">Volunteer</Link>
        </div>
      </section>
    </>
  );
}
