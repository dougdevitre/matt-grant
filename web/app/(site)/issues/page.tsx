import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ISSUES } from "@/lib/issues";
import { ASSETS_CDN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Issues",
  description: "The four fights Matt Grant is running on for Missouri's 2nd District: family-court reform, term limits, a smaller government, and lower taxes.",
};

export default function IssuesPage() {
  return (
    <section className="container-page py-16 sm:py-24">
      <p className="eyebrow text-brick">The platform</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">Four fights worth winning.</h1>
      <p className="mt-5 max-w-prose text-lg text-slate">
        Not a wish list — a docket. Each one is concrete and accountable. Open any issue for Matt&apos;s
        argument, his commitment, and a short video.
      </p>

      <div className="relative mt-10 aspect-[16/9] w-full overflow-hidden rounded-lg border border-line bg-white shadow-card">
        <Image
          src={`${ASSETS_CDN}/public/marketing/infographic.png`}
          alt="The Four Fights — Matt Grant's platform at a glance"
          fill
          sizes="(max-width: 1024px) 100vw, 1100px"
          className="object-contain"
          priority
        />
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {ISSUES.map((issue) => (
          <Link
            key={issue.slug}
            href={`/issues/${issue.slug}`}
            className="group card flex flex-col overflow-hidden p-0 transition-colors hover:border-ink"
          >
            <div className="relative aspect-square w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={issue.graphic} alt={issue.title} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="p-6">
              <p className="font-mono text-xs uppercase tracking-eyebrow text-gold">{issue.n} · {issue.eyebrow}</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink group-hover:text-brick">{issue.title}</h2>
              <p className="mt-2 text-slate">{issue.tagline}</p>
              <span className="mt-4 inline-block font-mono text-xs font-bold text-brick">Read the argument →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
