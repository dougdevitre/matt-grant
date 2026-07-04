"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CAMPAIGN } from "@/lib/site";
import { CtaButton } from "@/components/CtaButton";
import { commitToIssue, type CommitResult } from "@/app/(site)/issues/actions";

const WAYS = ["Share it with friends", "Talk to my neighbors", "Volunteer", "Host a conversation", "Chip in"];
const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-field/30";

export function IssueCommit({ slug, issueLabel }: { slug: string; issueLabel: string }) {
  const [state, action, pending] = useActionState<CommitResult | null, FormData>(commitToIssue, null);

  if (state?.ok) {
    return (
      <div className="card p-6 sm:p-8">
        <p className="eyebrow text-brick">You&apos;re in</p>
        <h3 className="mt-2 font-display text-2xl font-semibold text-ink">{state.message}</h3>
        <p className="mt-3 text-sm text-slate">Here&apos;s how to make it count right now:</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/media" className="btn-ink">Get graphics &amp; captions</Link>
          <CtaButton href={CAMPAIGN.donateUrl} external context="donate">Chip in</CtaButton>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card p-6 sm:p-8">
      <p className="eyebrow text-brick">Stand with Matt</p>
      <h3 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">Commit to this fight.</h3>
      <p className="mt-3 max-w-prose text-sm text-slate">
        Tell us you&apos;re with Matt on {issueLabel.toLowerCase()} and how you&apos;d like to help — we&apos;ll send you
        the ways to make it count between now and {CAMPAIGN.electionLabel}.
      </p>

      <input type="hidden" name="issue" value={slug} />
      <input type="hidden" name="issueLabel" value={issueLabel} />
      {/* Honeypot — hidden from people, catches bots */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Your name" aria-label="Your name" className={field} />
        <input name="email" type="email" required placeholder="you@email.com" aria-label="Email" className={field} />
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-ink">How you&apos;ll help</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {WAYS.map((w) => (
            <label key={w} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="ways" value={w} className="h-4 w-4 accent-brick" />
              {w}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" disabled={pending} className="btn-primary mt-6 disabled:opacity-60">
        {pending ? "Submitting…" : "I'm in →"}
      </button>
      {state && !state.ok && (
        <p className="mt-3 rounded-sm border border-brick/40 bg-brick/5 px-3 py-2 text-sm text-brick">{state.message}</p>
      )}
    </form>
  );
}
