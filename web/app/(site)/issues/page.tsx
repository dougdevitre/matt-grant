import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ISSUES } from "@/lib/issues";
import { ASSETS_CDN, CAMPAIGN } from "@/lib/site";
import { IssueSubmitForm } from "@/components/IssueSubmitForm";
import { IssueBoard } from "@/components/IssueBoard";

export const metadata: Metadata = {
  title: "Issues",
  description: "The four fights Matt Grant is running on for Missouri's 2nd District: family-court reform, term limits, a smaller government, and lower taxes.",
};

// Make the ISR contract explicit: regenerate the page (incl. the approved-topics
// board) at most every 5 minutes, independent of the inner fetch's revalidate
// tag. So a topic approved in Airtable goes public within ~5 min.
export const revalidate = 300;

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
            className="group card flex flex-col overflow-hidden p-0 transition duration-200 hover:-translate-y-1 hover:border-ink hover:shadow-lg motion-reduce:hover:translate-y-0"
          >
            <div className="relative aspect-square w-full overflow-hidden">
              <Image src={issue.graphic} alt={issue.title} fill className="object-cover" sizes="(max-width:640px) 100vw, 33vw" />
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

      {/* Turn conviction into action — funnel from the platform to the three
          primary conversions (join / vote / give). */}
      <div className="mt-16 border-t border-line pt-12 sm:mt-20 sm:pt-16">
        <p className="eyebrow text-brick">Now do something about it</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <Link href="/join" className="card group bg-white p-6 hover:border-ink">
            <span className="font-display text-lg font-semibold text-ink group-hover:text-brick">Join the campaign</span>
            <span className="mt-1 block text-sm text-slate">Get updates, volunteer, or lead a team.</span>
          </Link>
          <Link href="/vote" className="card group bg-white p-6 hover:border-ink">
            <span className="font-display text-lg font-semibold text-ink group-hover:text-brick">Make your plan to vote</span>
            <span className="mt-1 block text-sm text-slate">Confirm your registration for the August 4 primary.</span>
          </Link>
          <a href={CAMPAIGN.donateUrl} target="_blank" rel="noopener noreferrer" className="card group bg-white p-6 hover:border-ink">
            <span className="font-display text-lg font-semibold text-ink group-hover:text-brick">Donate</span>
            <span className="mt-1 block text-sm text-slate">Help carry these fights to {CAMPAIGN.electionLabel}.</span>
          </a>
        </div>
      </div>

      {/* Community submission board — supporters add the topics that matter to
          them; nothing is public until a human approves it in Airtable. */}
      <div className="mt-20 border-t border-line pt-16 sm:mt-24 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <IssueSubmitForm />
          <IssueBoard />
        </div>
      </div>
    </section>
  );
}
