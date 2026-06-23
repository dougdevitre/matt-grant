"use client";

import { useActionState } from "react";
import { sendDonorThankYou, type ThankState } from "@/app/dashboard/donors/actions";

// Per-row "Send thanks" button. Shows "Thanked ✓" once a thank-you has gone out
// (either previously, via thankedAt, or just now). No email on file → nothing to do.
export function DonorThankButton({ id, name, email, thankedAt }: { id: string; name: string; email: string | null; thankedAt: string | null }) {
  const [state, action, pending] = useActionState<ThankState | null, FormData>(sendDonorThankYou, null);
  if (!email) return <span className="font-mono text-[0.6rem] text-slate">no email</span>;
  const done = !!state?.ok || !!thankedAt;
  return (
    <form action={action} className="flex items-center justify-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="name" value={name} />
      <button
        type="submit"
        disabled={pending || done}
        className="whitespace-nowrap rounded-sm border border-line px-2.5 py-1 text-xs text-slate hover:border-ink hover:text-ink disabled:cursor-default disabled:opacity-60 disabled:hover:border-line disabled:hover:text-slate"
      >
        {pending ? "Sending…" : done ? "Thanked ✓" : "Send thanks"}
      </button>
      {state && !state.ok && <span className="font-mono text-[0.6rem] text-brick">{state.message}</span>}
    </form>
  );
}
