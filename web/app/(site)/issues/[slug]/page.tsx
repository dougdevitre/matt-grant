import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ISSUES, issueSlugs, getIssue } from "@/lib/issues";
import { CAMPAIGN } from "@/lib/site";

export function generateStaticParams() {
  return issueSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const issue = getIssue(slug);
  if (!issue) return {};
  return {
    title: issue.title,
    description: issue.tagline,
    openGraph: { title: issue.title, description: issue.tagline, images: [issue.graphic] },
  };
}

export default async function IssuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const issue = getIssue(slug);
  if (!issue) notFound();

  const idx = ISSUES.findIndex((i) => i.slug === slug);
  const prev = ISSUES[(idx - 1 + ISSUES.length) % ISSUES.length];
  const next = ISSUES[(idx + 1) % ISSUES.length];

  return (
    <>
      {/* Hero */}
      <section className="bg-ink text-paper">
        <div className="container-page py-14 sm:py-20">
          <Link href="/issues" className="font-mono text-xs uppercase tracking-eyebrow text-gold hover:text-paper">
            ← All issues
          </Link>
          <p className="mt-6 font-mono text-sm text-gold">{issue.n} · {issue.eyebrow}</p>
          <h1 className="mt-2 max-w-4xl text-4xl font-semibold sm:text-6xl">{issue.title}</h1>
          <p className="mt-4 max-w-prose text-lg text-paper/80">{issue.tagline}</p>
        </div>
      </section>

      {/* Video */}
      <section className="border-b border-line bg-white">
        <div className="container-page py-12 sm:py-16">
          <p className="eyebrow text-slate">Watch — {issue.eyebrow}</p>
          <div className="mt-4 overflow-hidden rounded-lg border border-line bg-ink shadow-card">
            <video
              src={issue.video}
              poster={issue.graphic}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-ink"
            />
          </div>
        </div>
      </section>

      {/* Argument + commitment */}
      <section className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="eyebrow text-brick">The argument</p>
          <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink">{issue.argument}</p>
        </div>
        <aside className="card h-fit bg-paper p-8">
          <p className="eyebrow text-gold">Matt's commitment</p>
          <p className="mt-3 font-display text-xl font-semibold text-ink">{issue.commitment}</p>
        </aside>
      </section>

      {/* Signature legislation (family-courts) */}
      {issue.signature && (
        <section className="bg-ink text-paper">
          <div className="container-page py-16 sm:py-20">
            <p className="eyebrow text-gold">Signature legislation</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{issue.signature.name}</h2>
            <p className="mt-4 max-w-prose text-paper/80">{issue.signature.body}</p>
            <a
              href={issue.signature.briefHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold mt-6 inline-block"
            >
              Read the one-page brief (PDF) ↓
            </a>

            {issue.signature.press && (
              <div className="mt-10">
                <p className="eyebrow text-paper/60">In the news</p>
                <p className="mt-1 text-sm text-paper/60">
                  Coverage of a pending federal lawsuit — allegations, not findings of fact.
                </p>
                <ul className="mt-4 divide-y divide-paper/10 border-y border-paper/10">
                  {issue.signature.press.map((p) => (
                    <li key={p.href} className="py-4">
                      <a href={p.href} target="_blank" rel="noopener noreferrer" className="group block">
                        <span className="font-mono text-xs uppercase tracking-eyebrow text-gold">{p.outlet}</span>
                        <span className="mt-1 block font-display text-lg font-semibold text-paper group-hover:text-gold">
                          {p.title} <span className="text-paper/50">↗</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Share + CTA */}
      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg border border-line shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={issue.graphic} alt={issue.title} className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="eyebrow text-brick">Take it with you</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Spread the word on {issue.eyebrow.toLowerCase()}.</h2>
            <p className="mt-4 max-w-prose text-slate">
              Grab the graphic and ready-to-post captions in the media library, or chip in to help carry
              this fight to {CAMPAIGN.electionLabel}.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/media" className="btn-ink">Graphics &amp; captions</Link>
              <a href={CAMPAIGN.donateUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">Donate</a>
            </div>
          </div>
        </div>

        {/* Prev / next */}
        <div className="mt-14 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
          <Link href={`/issues/${prev.slug}`} className="group rounded-sm border border-line p-5 hover:border-ink">
            <span className="font-mono text-xs uppercase tracking-eyebrow text-slate">← {prev.n}</span>
            <span className="mt-1 block font-display text-lg font-semibold text-ink group-hover:text-brick">{prev.title}</span>
          </Link>
          <Link href={`/issues/${next.slug}`} className="group rounded-sm border border-line p-5 text-right hover:border-ink">
            <span className="font-mono text-xs uppercase tracking-eyebrow text-slate">{next.n} →</span>
            <span className="mt-1 block font-display text-lg font-semibold text-ink group-hover:text-brick">{next.title}</span>
          </Link>
        </div>
      </section>
    </>
  );
}
