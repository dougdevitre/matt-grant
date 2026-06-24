import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PILLARS, getPillar } from "@/lib/pillars";
import { getManifest, getDoc } from "@/lib/pillars-content";
import { renderMarkdown } from "@/lib/markdown";
import { CAMPAIGN } from "@/lib/site";
import { PillarLink } from "@/components/PillarLink";

// A single synced resource article, rendered inside the shared chrome with the
// same typography as the legal/policy pages (PolicyPage). Content is synced from
// the pillar's access-to-* repo by scripts/sync-pillars.mjs and committed under
// web/content/pillars/<pillar>/. The catch-all [...slug] takes the first segment
// as the doc slug (tool embeds live under /tools/<tool>, a separate route).

export function generateStaticParams() {
  const params: { pillar: string; slug: string[] }[] = [];
  for (const pillar of PILLARS) {
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
  return { title: found.doc.title, description: `${getPillar(pillarSlug)?.eyebrow} — ${found.doc.title}` };
}

// Same scoped typography as components/PolicyPage.tsx, kept in sync by hand.
const PROSE =
  "mt-10 max-w-prose space-y-5 text-slate [&_a]:text-field [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded-sm [&_code]:bg-paper [&_code]:px-1 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-ink [&_pre]:p-4 [&_pre]:text-paper [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6";

export default async function PillarDocPage({ params }: { params: Promise<{ pillar: string; slug: string[] }> }) {
  const { pillar: pillarSlug, slug } = await params;
  const pillar = getPillar(pillarSlug);
  const found = pillar ? getDoc(pillarSlug, slug[0]) : null;
  if (!pillar || !found) notFound();

  const html = renderMarkdown(found.markdown);

  return (
    <section className="container-page py-16 sm:py-24">
      <div className="max-w-prose">
        <PillarLink slug={pillar.slug} path="" className="font-mono text-xs uppercase tracking-eyebrow text-brick hover:text-ink">
          ← {pillar.eyebrow}
        </PillarLink>
        <p className="mt-4 eyebrow text-slate">Community resource</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{found.doc.title}</h1>
      </div>

      <div className={PROSE} dangerouslySetInnerHTML={{ __html: html }} />

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
    </section>
  );
}
