"use client";

import { useActionState, useEffect } from "react";
import { submitPledge } from "@/app/(site)/join/actions";
import { CAMPAIGN } from "@/lib/site";
import type { IntakeResult } from "@/lib/volunteers/intake";

const input =
  "mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-field/30";

// "Donor Pledge" — captures intent (and optional amount) for follow-up, then hands
// off to WinRed for the actual gift. Real donor status is set by the WinRed webhook,
// not here; this is a soft commitment + a roster row.
export function JoinPledgeForm() {
  const [result, action, pending] = useActionState(
    async (_prev: IntakeResult | null, fd: FormData) => submitPledge(_prev, fd),
    null,
  );

  // On a successful pledge, send them to WinRed to complete the gift.
  useEffect(() => {
    if (result?.ok && typeof window !== "undefined") {
      const t = setTimeout(() => window.open(CAMPAIGN.donateUrl, "_blank", "noopener"), 600);
      return () => clearTimeout(t);
    }
  }, [result?.ok]);

  if (result?.ok) {
    return (
      <div className="rounded-sm border border-gold/40 bg-gold/10 p-5">
        <p className="font-display text-lg font-semibold text-ink">Thank you for your pledge.</p>
        <p className="mt-1 text-sm text-slate">{result.message}</p>
        <a href={CAMPAIGN.donateUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-3 inline-block">
          Complete your gift on WinRed →
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-ink">
          <span className="font-semibold">Name</span>
          <input name="name" required className={input} placeholder="Your name" />
        </label>
        <label className="text-sm text-ink">
          <span className="font-semibold">Email</span>
          <input name="email" type="email" required className={input} placeholder="you@email.com" />
        </label>
      </div>
      <label className="text-sm text-ink">
        <span className="font-semibold">I pledge to give (optional)</span>
        <input name="pledgeAmount" inputMode="decimal" className={input} placeholder="$50" />
      </label>
      {result && !result.ok && <p className="text-sm text-brick">{result.message}</p>}
      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
        {pending ? "Saving…" : "Pledge & continue to WinRed"}
      </button>
      <p className="text-xs text-slate">{CAMPAIGN.paidForBy}</p>
    </form>
  );
}
