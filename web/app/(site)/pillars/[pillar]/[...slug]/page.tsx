import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicPillars, getPillar } from "@/lib/pillars";
import { getManifest, getDoc } from "@/lib/pillars-content";
import { renderMarkdownDoc } from "@/lib/markdown";
import { CAMPAIGN, MAIN_SITE_URL } from "@/lib/site";
import { MermaidRender } from "@/components/MermaidRender";
import { Breadcrumbs } from "@/components/Breadcrumbs";

// A single synced resource article, rendered inside the shared chrome with the
// same typography as the legal/policy pages (PolicyPage). Content is synced from
// the pillar's access-to-* repo by scripts/sync-pillars.mjs and committed under
// web/content/pillars/<pillar>/. The catch-all [...slug] takes the first segment
// as the doc slug (tool embeds live under /tools/<tool>, a separate route).

export function generateStaticParams() {
  const params: { pillar: string; slug: string[] }[] = [];
  for (const pillar of publicPillars) {
    const manifest = getManifest(pillar.slug);
    for (const doc of manifest?.docs ?? []) {
      params.push({ pillar: pillar.slug, slug: [doc.slug] });
    }
  }
  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ pillar: string; slug: string[] }> }): Promise<Metadata> {
  const { pillar: pillarSlug, slug } = await params;
  const found = getDoc(pillarSlug, slug[0]);
  if (!found) return {};
  // Canonical = the apex path (subdomains aren't provisioned) — same convention as the
  // parent pillar page, which the child routes previously skipped.
  const canonical = `${MAIN_SITE_URL}/pillars/${pillarSlug}/${slug.join("/")}`;
  const description = `${getPillar(pillarSlug)?.eyebrow} — ${found.doc.title}`;
  return {
    title: found.doc.title,
    description,
    alternates: { canonical },
    openGraph: { title: found.doc.title, description, url: canonical },
  };
}

// Same scoped typography as components/PolicyPage.tsx, kept in sync by hand.
const PROSE =
  "mt-10 max-w-prose space-y-5 text-slate [&_a]:text-field [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded-sm [&_code]:bg-paper [&_code]:px-1 [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:scroll-mt-24 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-ink [&_pre]:p-4 [&_pre]:text-paper [&_strong]:text-ink [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:border [&_th]:border-line [&_th]:bg-paper [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6";

export default async function PillarDocPage({ params }: { params: Promise<{ pillar: string; slug: string[] }> }) {
  const { pillar: pillarSlug, slug } = await params;
  const pillar = getPillar(pillarSlug);
  const found = pillar && !pillar.hidden ? getDoc(pillarSlug, slug[0]) : null;
  if (!pillar || pillar.hidden || !found) notFound();

  const { html, headings } = renderMarkdownDoc(found.markdown);
  const minutes = Math.max(1, Math.round(found.markdown.split(/\s+/).filter(Boolean).length / 200));
  const toc = headings.filter((h) => h.level === 2 || h.level === 3);
  const siblings = (getManifest(pillarSlug)?.docs ?? []).filter((d) => d.slug !== slug[0]).slice(0, 6);

  return (
    <section className="container-page py-16 sm:py-24">
      <div className="max-w-prose">
        <Breadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name: pillar.eyebrow, href: `/pillars/${pillar.slug}` },
            { name: found.doc.title },
          ]}
        />
        <p className="mt-4 eyebrow text-slate">Community resource</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{found.doc.title}</h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-eyebrow text-slate">
          {pillar.eyebrow} · {minutes} min read
        </p>
      </div>

      <div className="mt-10 lg:grid lg:grid-cols-[1fr_14rem] lg:items-start lg:gap-12">
        <div className="min-w-0">
          <div className={PROSE} dangerouslySetInnerHTML={{ __html: html }} />
          {html.includes('class="mermaid"') && <MermaidRender />}

          {siblings.length > 0 && (
            <div className="mt-14 max-w-prose border-t border-line pt-8">
              <p className="eyebrow text-field">More in {pillar.eyebrow}</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {siblings.map((d) => (
                  <li key={d.slug}>
                    <Link
                      href={`/pillars/${pillar.slug}/${d.slug}`}
                      className="group block h-full rounded-sm border border-line bg-white p-4 hover:border-ink"
                    >
                      <span className="font-display text-sm font-semibold leading-snug text-ink group-hover:text-brick">
                        {d.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/pillars/${pillar.slug}`}
                className="mt-5 inline-block font-mono text-xs uppercase tracking-eyebrow text-field hover:text-ink"
              >
                ← All {pillar.eyebrow} resources
              </Link>
            </div>
          )}

          <div className="mt-12 max-w-prose border-t border-line pt-6 text-xs leading-relaxed text-slate">
            <p>
              Nonpartisan informational resource for {CAMPAIGN.district} — not legal, medical, or
              financial advice. Source:{" "}
              <a href={pillar.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                {pillar.sourceRepo}
              </a>
              .
            </p>
            <p className="mt-1 font-semibold text-ink">{CAMPAIGN.paidForBy}</p>
          </div>
        </div>

        {/* On-page table of contents — sticky on desktop, hidden on mobile */}
        {toc.length > 1 && (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="font-mono text-xs uppercase tracking-eyebrow text-slate">On this page</p>
              <nav aria-label="Table of contents" className="mt-3">
                <ul className="space-y-1 text-sm">
                  {toc.map((h) => (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        className={`-ml-px block border-l-2 border-line py-1 pl-3 text-slate hover:border-ink hover:text-ink ${
                          h.level === 3 ? "pl-6" : ""
                        }`}
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
