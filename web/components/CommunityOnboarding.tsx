"use client";

import { useActionState } from "react";
import { saveOnboarding } from "@/app/(site)/community/actions";
import { ISSUE_AXES } from "@/lib/integrations/research/issues";

// Ways-to-help options. Keys must match WAYS_TO_HELP in lib/profile.ts (the server
// validates against that set, so a mismatched key is simply dropped).
const WAYS: { key: string; label: string }[] = [
  { key: "donate", label: "Donate" },
  { key: "volunteer", label: "Volunteer" },
  { key: "host", label: "Host an event" },
  { key: "share", label: "Share online" },
  { key: "yardSign", label: "Put up a yard sign" },
  { key: "writeLetters", label: "Write letters" },
];

const chip =
  "flex cursor-pointer items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm text-ink hover:border-ink has-[:checked]:border-brick has-[:checked]:bg-brick/5";

// Non-blocking onboarding card on /community. Lets a supporter tell us what they
// care about and how they want to help — drives personalization + targeted email.
// The hub still renders fully below it; this is additive, never a gate.
export function CommunityOnboarding() {
  const [done, action, pending] = useActionState(async (_prev: boolean, fd: FormData) => {
    await saveOnboarding(fd);
    return true;
  }, false);

  if (done) {
    return (
      <div className="mt-8 rounded-sm border border-field/40 bg-field/5 p-5">
        <p className="font-display text-lg font-semibold text-ink">Thanks — you&apos;re all set.</p>
        <p className="mt-1 text-sm text-slate">We&apos;ll tailor what we send you to what you told us. You can update it anytime.</p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 rounded-sm border border-line bg-paper p-6">
      <p className="eyebrow text-brick">Make it yours</p>
      <h2 className="mt-2 text-xl font-semibold">Tell us what you care about</h2>
      <p className="mt-1 text-sm text-slate">A few taps so we send you what&apos;s relevant — and connect you to the work you want to do.</p>

      <p className="mt-5 text-sm font-semibold text-ink">The issues that matter to you</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {ISSUE_AXES.map((a) => (
          <label key={a.id} className={chip}>
            <input type="checkbox" name="issues" value={a.id} className="h-4 w-4 accent-brick" />
            {a.label}
          </label>
        ))}
      </div>

      <p className="mt-5 text-sm font-semibold text-ink">How you&apos;d like to help</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {WAYS.map((w) => (
          <label key={w.key} className={chip}>
            <input type="checkbox" name="waysToHelp" value={w.key} className="h-4 w-4 accent-brick" />
            {w.label}
          </label>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-sm text-ink">
          <span className="block font-semibold">Your ZIP</span>
          <input
            name="zip"
            inputMode="numeric"
            placeholder="63101"
            maxLength={5}
            className="mt-1 w-32 rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-field/30"
          />
          <span className="mt-1 block text-xs text-slate">So we can point you to local action.</span>
        </label>
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
          {pending ? "Saving…" : "Save my preferences"}
        </button>
      </div>
    </form>
  );
}
