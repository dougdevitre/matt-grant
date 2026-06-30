import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicPillars, publicPillarSlugs, getPillar } from "@/lib/pillars";
import { getIssue } from "@/lib/issues";
import { getManifest } from "@/lib/pillars-content";
import { CAMPAIGN, MAIN_SITE_URL } from "@/lib/site";
import { PillarLink } from "@/components/PillarLink";

// Pillar resource hub — served on its subdomain (e.g. education.mattgrant…org) via
// the host rewrite in middleware.ts, so it inherits the shared SiteHeader/Footer/
// AskMatt from app/(site)/layout.tsx. Data-driven from lib/pillars.ts; synced repo
// content (if present) comes from lib/pillars-content.ts. Mirrors the structure of
// app/(site)/issues/[slug]/page.tsx.

export function generateStaticParams() {
  return publicPillarSlugs.map((pillar) => ({ pillar }));
}

export async function generateMetadata({ params }: { params: Promise<{ pillar: string }> }): Promise<Metadata> {
  const { pillar: slug } = await params;
  const pillar = getPillar(slug);
  if (!pillar) return {};
  // Canonical = the apex path that actually resolves. The pillar subdomains
  // (education.mattgrantforcongress.org, …) are NOT provisioned in DNS, so a
  // subdomain canonical pointed Google at a dead URL and blocked indexing.
  const canonical = `${MAIN_SITE_URL}/pillars/${slug}`;
  return {
    title: pillar.title,
    description: pillar.tagline,
    alternates: { canonical },
    openGraph: { title: pillar.title, description: pillar.tagline, url: canonical },
  };
}

// Main-site links must be absolute to the apex — this page can be served on a
// subdomain where a relative "/act" would 404.
const apex = (path: string) => `${MAIN_SITE_URL}${path}`;

export default async function PillarPage({ params }: { params: Promise<{ pillar: string }> }) {
  const { pillar: slug } = await params;
  const pillar = getPillar(slug);
  if (!pillar || pillar.hidden) notFound();

  const manifest = getManifest(pillar.slug);
  const related = pillar.relatedIssue ? getIssue(pillar.relatedIssue) : undefined;

  return (
    <>
      {/* Hero */}
      <section className="bg-ink text-paper">
        <div className="container-page py-14 sm:py-20">
          <p className="font-mono text-sm text-goldlight">{pillar.eyebrow}</p>
          <h1 className="mt-2 max-w-4xl text-4xl font-semibold sm:text-6xl">{pillar.title}</h1>
          <p className="mt-4 max-w-prose text-lg text-paper/80">{pillar.tagline}</p>
        </div>
      </section>

      {/* Nonpartisan resource disclaimer */}
      <section className="border-b border-line bg-paper">
        <div className="container-page py-4">
          <p className="text-sm text-slate">
            <span className="font-semibold text-ink">A community resource.</span> This is a
            nonpartisan resource navigator for {CAMPAIGN.district} — informational only, not a
            campaign policy position and not legal, medical, or financial advice.
          </p>
        </div>
      </section>

      {/* Intro / framing */}
      <section className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="eyebrow text-brick">About this hub</p>
          <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink">{pillar.blurb}</p>
        </div>
        {related && (
          <aside className="card h-fit bg-paper p-8">
            <p className="eyebrow text-gold">Related priority</p>
            <p className="mt-3 font-display text-xl font-semibold text-ink">{related.title}</p>
            <p className="mt-2 text-sm text-slate">{related.tagline}</p>
            <a href={apex(`/issues/${related.slug}`)} className="btn-ink mt-5 inline-block">
              Where Matt stands →
            </a>
          </aside>
        )}
      </section>

      {/* Resources (synced from the access-to repo) */}
      <section className="border-t border-line bg-paper">
        <div className="container-page py-16 sm:py-20">
          <p className="eyebrow text-field">Resources &amp; tools</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">
            Real-time help for {pillar.eyebrow.replace(/^Access to /, "").toLowerCase()}
          </h2>

          {manifest && (manifest.docs.length > 0 || manifest.tools.length > 0) ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {manifest.docs.map((doc) => (
                <PillarLink
                  key={doc.slug}
                  slug={pillar.slug}
                  path={`/${doc.slug}`}
                  className="card group bg-white p-6 hover:border-ink"
                >
                  <span className="font-mono text-xs uppercase tracking-eyebrow text-slate">Guide</span>
                  <span className="mt-1 block font-display text-lg font-semibold text-ink group-hover:text-brick">
                    {doc.title}
                  </span>
                </PillarLink>
              ))}
              {manifest.tools.map((tool) => (
                <PillarLink
                  key={tool.slug}
                  slug={pillar.slug}
                  path={`/tools/${tool.slug}`}
                  className="card group bg-white p-6 hover:border-ink"
                >
                  <span className="font-mono text-xs uppercase tracking-eyebrow text-slate">Tool</span>
                  <span className="mt-1 block font-display text-lg font-semibold text-ink group-hover:text-brick">
                    {tool.label}
                  </span>
                </PillarLink>
              ))}
            </div>
          ) : (
            <p className="mt-6 max-w-prose text-slate">
              Resources for this hub are maintained in the open-source{" "}
              <a href={pillar.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-field underline">
                {pillar.sourceRepo}
              </a>{" "}
              project and are being prepared for {CAMPAIGN.district}. Check back soon.
            </p>
          )}

          <p className="mt-8 text-xs text-slate">
            Source:{" "}
            <a href={pillar.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
              {pillar.sourceRepo}
            </a>
            {manifest?.syncedAt ? ` · last synced ${manifest.syncedAt}` : ""}
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-6 sm:grid-cols-3">
          <a href={apex("/act")} className="card group bg-white p-6 hover:border-ink">
            <span className="font-display text-lg font-semibold text-ink group-hover:text-brick">Take action</span>
            <span className="mt-1 block text-sm text-slate">Make your plan for the August 4 primary.</span>
          </a>
          <a href={apex("/vote")} className="card group bg-white p-6 hover:border-ink">
            <span className="font-display text-lg font-semibold text-ink group-hover:text-brick">Check your registration</span>
            <span className="mt-1 block text-sm text-slate">Confirm you&apos;re ready to vote in {CAMPAIGN.district}.</span>
          </a>
          <a href={CAMPAIGN.donateUrl} target="_blank" rel="noopener noreferrer" className="card group bg-white p-6 hover:border-ink">
            <span className="font-display text-lg font-semibold text-ink group-hover:text-brick">Donate</span>
            <span className="mt-1 block text-sm text-slate">Help carry this work to {CAMPAIGN.electionLabel}.</span>
          </a>
        </div>

        {/* Other pillars */}
        <div className="mt-14 border-t border-line pt-8">
          <p className="eyebrow text-slate">More resource hubs</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {publicPillars.filter((p) => p.slug !== pillar.slug).map((p) => (
              <a
                key={p.slug}
                href={apex(`/pillars/${p.slug}`)}
                className="rounded-sm border border-line px-3 py-2 text-sm font-semibold text-slate hover:border-ink hover:text-ink"
              >
                {p.eyebrow}
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
