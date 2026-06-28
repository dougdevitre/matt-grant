"use client";

import { useActionState } from "react";
import { submitUpdates } from "@/app/(site)/join/actions";
import type { IntakeResult } from "@/lib/volunteers/intake";

const input =
  "mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink";

// "Get Updates" — the lowest-barrier door. No account: just enough to reach them
// by email/SMS. Writes a DynamoDB lead + Airtable roster row + (on opt-in) SMS consent.
export function JoinUpdatesForm() {
  const [result, action, pending] = useActionState(
    async (_prev: IntakeResult | null, fd: FormData) => submitUpdates(_prev, fd),
    null,
  );

  if (result?.ok) {
    return (
      <div className="rounded-sm border border-field/40 bg-field/5 p-5">
        <p className="font-display text-lg font-semibold text-ink">You&apos;re on the list.</p>
        <p className="mt-1 text-sm text-slate">{result.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {/* Honeypot — hidden from real users */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-ink">
          <span className="font-semibold">Name</span>
          <input name="name" required className={input} placeholder="Your name" />
        </label>
        <label className="text-sm text-ink">
          <span className="font-semibold">ZIP</span>
          <input name="zip" inputMode="numeric" maxLength={5} className={input} placeholder="63101" />
        </label>
        <label className="text-sm text-ink">
          <span className="font-semibold">Email</span>
          <input name="email" type="email" className={input} placeholder="you@email.com" />
        </label>
        <label className="text-sm text-ink">
          <span className="font-semibold">Mobile (optional)</span>
          <input name="phone" type="tel" className={input} placeholder="(314) 555-0123" />
        </label>
      </div>
      <label className="flex items-start gap-2 text-xs text-slate">
        <input type="checkbox" name="smsOptIn" value="1" className="mt-0.5 h-4 w-4 accent-brick" />
        <span>Text me campaign updates. Msg &amp; data rates may apply; reply STOP to opt out.</span>
      </label>
      {result && !result.ok && <p className="text-sm text-brick">{result.message}</p>}
      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
        {pending ? "Joining…" : "Keep me posted"}
      </button>
    </form>
  );
}
