import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ISSUES, issueSlugs, getIssue } from "@/lib/issues";
import { CAMPAIGN, SITE_URL } from "@/lib/site";
import { IssueCommit } from "@/components/IssueCommit";
import { IssueActionPlan } from "@/components/IssueActionPlan";
import { IssueLocalIntersection } from "@/components/IssueLocalIntersection";
import { localResponseEnabled } from "@/lib/issues/localResponse";
import { IssueChecklist } from "@/components/IssueChecklist";
import { CtaButton } from "@/components/CtaButton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { publicPillars } from "@/lib/pillars";
import { captionTrackFor } from "@/lib/captions";
import { Figure } from "@/components/data/Figure";

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

  // Public resource hubs that map to this issue (e.g. family-courts → education).
  const relatedPillars = publicPillars.filter((p) => p.relatedIssue === issue.slug);

  // WCAG 1.2.2: captions track for this issue's video, if an authored .vtt exists.
  const cap = captionTrackFor(issue.video);

  return (
    <>
      {/* Hero */}
      <section className="bg-ink text-paper">
        <div className="container-page py-14 sm:py-20">
          <Breadcrumbs
            variant="dark"
            items={[
              { name: "Home", href: "/" },
              { name: "Issues", href: "/issues" },
              { name: issue.title },
            ]}
          />
          <p className="mt-6 font-mono text-sm text-goldlight">{issue.n} · {issue.eyebrow}</p>
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
            >
              {cap && <track kind="captions" src={cap.src} srcLang={cap.srclang} label={cap.label} default />}
            </video>
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
          <p className="eyebrow text-gold">Matt&apos;s commitment</p>
          <p className="mt-3 font-display text-xl font-semibold text-ink">{issue.commitment}</p>
        </aside>
      </section>

      {/* The data (Children First / family-courts only) */}
      {issue.slug === "family-courts" && (
        <section className="border-t border-line bg-white">
          <div className="container-page py-12 sm:py-16">
            <p className="eyebrow text-brick">The data</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Fewer children in MO-02 every year</h2>
            <Figure id="mo02-child-under15" />
            <Link href="/data/mo-02-by-the-numbers" className="btn-ghost text-sm">
              See MO-02 by the numbers →
            </Link>
          </div>
        </section>
      )}

      {/* Signature legislation (family-courts) */}
      {issue.signature && (
        <section className="bg-ink text-paper">
          <div className="container-page py-16 sm:py-20">
            <p className="eyebrow text-goldlight">Signature legislation</p>
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
                        <span className="font-mono text-xs uppercase tracking-eyebrow text-goldlight">{p.outlet}</span>
                        <span className="mt-1 block font-display text-lg font-semibold text-paper group-hover:text-goldlight">
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

      {/* Curated, always-on checklist (no AI) */}
      {issue.checklist && issue.checklist.length > 0 && (
        <section className="border-t border-line bg-paper">
          <div className="container-page py-16 sm:py-20">
            <div className="mx-auto max-w-2xl">
              <IssueChecklist issue={issue} />
            </div>
          </div>
        </section>
      )}

      {/* Local data intersection — cited local figures + documented commitment */}
      <section className="border-t border-line bg-paper">
        <div className="container-page py-16 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <IssueLocalIntersection issueSlug={issue.slug} issueLabel={issue.eyebrow} commitment={issue.commitment} aiEnabled={localResponseEnabled()} />
          </div>
        </div>
      </section>

      {/* Make your plan for this issue */}
      <section id="make-your-plan" className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <IssueActionPlan issueSlug={issue.slug} issueLabel={issue.eyebrow} />
        </div>
      </section>

      {/* Commit to this issue */}
      <section className="border-t border-line bg-paper">
        <div className="container-page py-16 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <IssueCommit slug={issue.slug} issueLabel={issue.eyebrow} />
          </div>
        </div>
      </section>

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
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(issue.tagline)}&url=${encodeURIComponent(`${SITE_URL}/issues/${issue.slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ink"
              >
                Share on X
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${SITE_URL}/issues/${issue.slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                Share on Facebook
              </a>
              <Link href="/media" className="btn-ghost">Graphics &amp; captions</Link>
              <CtaButton href={CAMPAIGN.donateUrl} external context="donate">Donate</CtaButton>
              <Link href="/join" className="btn-ghost">Join the campaign</Link>
              <Link href="/vote" className="btn-ghost">Make your plan to vote</Link>
            </div>
          </div>
        </div>

        {/* Related resource hubs (nonpartisan), when this issue maps to one */}
        {relatedPillars.length > 0 && (
          <div className="mt-14 border-t border-line pt-8">
            <p className="eyebrow text-field">Related resources</p>
            <p className="mt-2 max-w-prose text-sm text-slate">
              Nonpartisan help for {CAMPAIGN.district} families connected to this issue.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedPillars.map((p) => (
                <Link
                  key={p.slug}
                  href={`/pillars/${p.slug}`}
                  className="rounded-sm border border-line px-3 py-2 text-sm font-semibold text-slate hover:border-ink hover:text-ink"
                >
                  {p.eyebrow} →
                </Link>
              ))}
            </div>
          </div>
        )}

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
