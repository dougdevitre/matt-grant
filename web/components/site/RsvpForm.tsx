"use client";

import { useState, useTransition } from "react";
import { rsvp, type RsvpState } from "@/app/(site)/events/actions";

const input = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink";

export function RsvpForm({ eventId, full = false, spotsLeft = null }: { eventId: string; full?: boolean; spotsLeft?: number | null }) {
  const [state, setState] = useState<RsvpState | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (formData: FormData) =>
    start(async () => {
      const res = await rsvp(formData);
      setState(res);
    });

  if (full) {
    return (
      <div className="rounded-lg border border-line bg-paper p-5 text-sm text-ink">
        <p className="font-display text-lg font-semibold">This event is at capacity</p>
        <p className="mt-1 text-slate">Thanks for your interest — check the calendar for other ways to get involved.</p>
      </div>
    );
  }

  if (state?.ok) {
    return (
      <div className="rounded-lg border border-field/40 bg-field/10 p-5 text-sm text-ink">
        <p className="font-semibold">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="rounded-lg border border-line bg-paper p-5">
      <input type="hidden" name="eventId" value={eventId} />
      <p className="font-display text-lg font-semibold text-ink">RSVP &amp; sign up to help</p>
      {spotsLeft != null && spotsLeft <= 10 && (
        <p className="mt-1 text-xs font-semibold text-brick">Only {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left</p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Your name" aria-label="Your name" className={`${input} sm:col-span-2`} />
        <input name="email" type="email" placeholder="Email (optional)" aria-label="Email (optional)" className={input} />
        <input name="phone" type="tel" placeholder="Mobile (optional)" aria-label="Mobile (optional)" className={input} />
        <select name="role" aria-label="How you'd like to help" className={input} defaultValue="">
          <option value="">I&apos;m attending</option>
          <option value="Canvass">Help canvass</option>
          <option value="Phones">Help make calls</option>
          <option value="Table">Staff a table</option>
          <option value="Setup">Setup / teardown</option>
        </select>
        <input name="count" type="number" min={1} max={20} defaultValue={1} aria-label="How many people" className={input} />
      </div>
      <label className="mt-3 flex items-start gap-2 text-xs text-slate">
        <input type="checkbox" name="smsOptIn" value="1" className="mt-0.5" />
        <span>
          Text me campaign updates from Matt Grant for Congress (optional). Msg &amp; data rates may apply; reply STOP to opt
          out.
        </span>
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
          {pending ? "Sending…" : "Count me in"}
        </button>
        {state && !state.ok && <span className="text-sm text-brick">{state.message}</span>}
      </div>
      <p className="mt-3 text-xs text-slate">
        We&apos;ll use your contact info to follow up about this event. Texts only if you check the box above.
      </p>
    </form>
  );
}
