"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitTopic, type TopicResult } from "@/app/(site)/issues/actions";

const field =
  "w-full rounded-sm border border-line bg-white px-4 py-3 text-ink placeholder:text-slate/60 focus:border-field";

// Public submission form for the moderated issues bulletin board. Mirrors
// ContactForm's idiom (useActionState, honeypot, status banner). Posts are
// anonymous once approved — the name/email/phone below stay private to the
// campaign — so the copy says so plainly.
export function IssueSubmitForm() {
  const [state, action, pending] = useActionState<TopicResult | null, FormData>(submitTopic, null);

  return (
    <form action={action} className="card p-8">
      {/* Honeypot: hidden from people + screen readers; bots fill it. */}
      <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden" aria-label="Leave this field empty">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <p className="eyebrow text-brick">Your voice</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">Tell us what matters to you.</h2>
      <p className="mt-2 text-slate">
        Submit a topic you want Matt to take on. We read every one — approved topics are posted anonymously
        below.
      </p>

      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-semibold text-ink">Topic</span>
        <input name="topic" required maxLength={140} className={field} placeholder="e.g. Veterans' access to care in MO-02" />
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-semibold text-ink">Why it matters</span>
        <textarea name="details" required rows={4} maxLength={2000} className={field} placeholder="Tell us why this is important to you and your community." />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">First name <span className="font-normal text-slate">(optional)</span></span>
          <input name="name" className={field} placeholder="Your first name" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">City <span className="font-normal text-slate">(optional)</span></span>
          <input name="city" className={field} placeholder="e.g. Kirkwood" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Email <span className="font-normal text-slate">(optional)</span></span>
          <input type="email" name="email" className={field} placeholder="you@example.com" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Phone <span className="font-normal text-slate">(optional)</span></span>
          <input name="phone" className={field} placeholder="(314) 555-0123" />
        </label>
      </div>

      <label className="mt-4 flex items-start gap-2.5">
        <input type="checkbox" name="smsOptIn" value="yes" className="mt-0.5 h-4 w-4 shrink-0 accent-field" />
        <span className="text-sm text-ink">
          Text me campaign updates at this number. Msg &amp; data rates may apply; message frequency varies.
          Reply STOP to opt out, HELP for help.
        </span>
      </label>

      <button type="submit" disabled={pending} className="btn-primary mt-6 w-full disabled:opacity-60">
        {pending ? "Submitting…" : "Submit my topic"}
      </button>

      <p className="mt-4 text-xs leading-relaxed text-slate">
        Posts are reviewed before they appear and are shown anonymously. Your name, email, and phone stay
        private to the campaign and are used only to follow up — we never sell your information. See our{" "}
        <Link href="/data-policy" className="underline hover:text-brick">
          Data Policy
        </Link>
        .
      </p>

      {state && (
        <p
          role="status"
          className={`mt-4 rounded-sm border px-4 py-3 text-sm ${
            state.ok ? "border-field/40 bg-field/10 text-field" : "border-brick/40 bg-brick/10 text-brick"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
