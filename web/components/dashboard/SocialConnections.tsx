"use client";

import { useActionState } from "react";
import { testConnectionsAction } from "@/app/dashboard/social/actions";
import { CHANNELS } from "@/lib/social/channels";
import type { ChannelStatus } from "@/lib/social/publish";

// Read-only connection tester. Calls each platform's account-read endpoint (never
// posts) so an admin can confirm credentials resolve to the right account before
// scheduling a real publish.
export function SocialConnections() {
  const [state, action, pending] = useActionState<{ statuses: ChannelStatus[] }, FormData>(testConnectionsAction, { statuses: [] });
  return (
    <form action={action} className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow text-slate">Channel connections</p>
          <p className="mt-1 text-xs text-slate">Read-only check — verifies tokens &amp; IDs resolve to an account. Never posts.</p>
        </div>
        <button type="submit" disabled={pending} className="btn-ghost disabled:opacity-50">
          {pending ? "Testing…" : "Test connections"}
        </button>
      </div>
      {state.statuses.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-sm border border-line">
          {state.statuses.map((s) => (
            <li key={s.channel} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 font-semibold text-ink">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHANNELS[s.channel].color }} />
                {CHANNELS[s.channel].label}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-right text-xs text-slate">{s.detail}</span>
                <span
                  className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow ${
                    s.mode === "manual" ? "bg-ink/5 text-slate" : s.ok ? "bg-field/10 text-field" : "bg-brick/10 text-brick"
                  }`}
                >
                  {s.mode === "manual" ? "manual" : s.ok ? "API ✓" : "error"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
