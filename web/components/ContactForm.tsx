"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitContact, type ContactResult } from "@/app/(site)/contact/actions";

const INTERESTS = ["Knock doors", "Make calls", "Host an event", "Yard sign", "Donate", "Other"];

const field =
  "w-full rounded-sm border border-line bg-white px-4 py-3 text-ink placeholder:text-slate/60 focus:border-field";

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactResult | null, FormData>(submitContact, null);

  return (
    <form action={action} className="card p-8">
      {/* Honeypot: hidden from people (and screen readers), but bots tend to fill
          every field. A non-empty "company" is treated as spam server-side. */}
      <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden" aria-label="Leave this field empty">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <p className="eyebrow text-brick">Get involved</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">Join the team.</h2>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Name</span>
          <input name="name" required className={field} placeholder="Your name" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">City</span>
          <input name="city" className={field} placeholder="e.g. Kirkwood" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Email</span>
          <input type="email" name="email" className={field} placeholder="you@example.com" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Phone</span>
          <input name="phone" className={field} placeholder="(314) 555-0123" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">ZIP code</span>
          <input name="zip" inputMode="numeric" maxLength={5} className={field} placeholder="63017" />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-semibold text-ink">I&apos;d like to…</legend>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <label key={i} className="cursor-pointer">
              <input type="checkbox" name="interests" value={i} className="peer sr-only" />
              <span className="inline-block rounded-sm border border-line px-3 py-1.5 text-sm text-slate peer-checked:border-field peer-checked:bg-field peer-checked:text-paper">
                {i}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 block">
        <span className="mb-1 block text-sm font-semibold text-ink">Message (optional)</span>
        <textarea name="message" rows={3} className={field} placeholder="Anything you'd like us to know" />
      </label>

      <label className="mt-5 flex items-start gap-2.5">
        <input type="checkbox" name="smsOptIn" value="yes" className="mt-0.5 h-4 w-4 shrink-0 accent-field" />
        <span className="text-sm text-ink">
          Text me campaign updates at this number. Msg &amp; data rates may apply; message frequency varies.
          Reply STOP to opt out, HELP for help.
        </span>
      </label>

      <button type="submit" disabled={pending} className="btn-primary mt-6 w-full disabled:opacity-60">
        {pending ? "Sending…" : "Count me in"}
      </button>

      <p className="mt-4 text-xs leading-relaxed text-slate">
        We&apos;ll use your information only to follow up about the campaign — we never sell it. We&apos;ll send
        automated text updates only if you check the box above; reply STOP to any text to opt out. See our{" "}
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
