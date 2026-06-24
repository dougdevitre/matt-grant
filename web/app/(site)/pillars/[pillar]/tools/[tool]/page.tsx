import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicPillars, getPillar } from "@/lib/pillars";
import { getManifest } from "@/lib/pillars-content";
import { CAMPAIGN } from "@/lib/site";
import { PillarLink } from "@/components/PillarLink";

// Chrome-wrapped embed of a standalone HTML tool synced from the pillar's
// access-to-* repo. The raw tool file is served as a static asset from
// public/pillar-tools/<pillar>/<file> (a path OUTSIDE the /pillars route tree, so
// it can't collide with these routes) and shown in a sandboxed iframe inside the
// shared header/footer.

export function generateStaticParams() {
  const params: { pillar: string; tool: string }[] = [];
  for (const pillar of publicPillars) {
    const manifest = getManifest(pillar.slug);
    for (const tool of manifest?.tools ?? []) {
      params.push({ pillar: pillar.slug, tool: tool.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ pillar: string; tool: string }> }): Promise<Metadata> {
  const { pillar: pillarSlug, tool: toolSlug } = await params;
  const tool = getManifest(pillarSlug)?.tools.find((t) => t.slug === toolSlug);
  if (!tool) return {};
  return { title: `${tool.label} — ${getPillar(pillarSlug)?.eyebrow}` };
}

export default async function PillarToolPage({ params }: { params: Promise<{ pillar: string; tool: string }> }) {
  const { pillar: pillarSlug, tool: toolSlug } = await params;
  const pillar = getPillar(pillarSlug);
  const tool = pillar && !pillar.hidden ? getManifest(pillarSlug)?.tools.find((t) => t.slug === toolSlug) : undefined;
  if (!pillar || pillar.hidden || !tool) notFound();

  const src = `/pillar-tools/${pillar.slug}/${tool.file}`;

  return (
    <section className="container-page py-10 sm:py-14">
      <PillarLink slug={pillar.slug} path="" className="font-mono text-xs uppercase tracking-eyebrow text-brick hover:text-ink">
        ← {pillar.eyebrow}
      </PillarLink>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{tool.label}</h1>
      <p className="mt-2 text-sm text-slate">
        Interactive tool — runs in your browser; nothing is submitted to the campaign.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-line shadow-card">
        <iframe
          src={src}
          title={tool.label}
          className="h-[80vh] w-full bg-white"
          referrerPolicy="no-referrer"
          // The tool HTML is synced from an external access-to-* repo, so treat it as
          // untrusted. NO `allow-same-origin`: with `allow-scripts` that pair would let
          // the framed doc escape the sandbox and script the app's own origin (cookies,
          // localStorage, same-origin fetch). Omitting it gives the tool a unique opaque
          // origin — scripts still run, but it can't touch the app. A restrictive CSP on
          // /pillar-tools/* (next.config.mjs: connect-src 'none', frame-ancestors 'self')
          // blocks exfiltration and external embedding as defense in depth.
          sandbox="allow-scripts allow-forms allow-popups"
        />
      </div>

      <p className="mt-6 max-w-prose text-xs text-slate">
        Nonpartisan informational tool for {CAMPAIGN.district} — not legal, medical, or financial
        advice. Source:{" "}
        <a href={pillar.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
          {pillar.sourceRepo}
        </a>
        . {CAMPAIGN.paidForBy}
      </p>
    </section>
  );
}
