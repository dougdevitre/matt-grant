"use client";

import { useActionState } from "react";
import { testConnectionsAction, disconnectAction } from "@/app/dashboard/social/actions";
import { CHANNELS } from "@/lib/social/channels";
import type { ChannelStatus } from "@/lib/social/publish";

export type MetaConnection = { connected: boolean; detail?: string };

// Read-only connection tester. Calls each platform's account-read endpoint (never
// posts) so an admin can confirm credentials resolve to the right account before
// scheduling a real publish.
export function SocialConnections({ meta = { connected: false } }: { meta?: MetaConnection }) {
  const [state, action, pending] = useActionState<{ statuses: ChannelStatus[] }, FormData>(testConnectionsAction, { statuses: [] });
  return (
    <form action={action} className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow text-slate">Channel connections</p>
          <p className="mt-1 text-xs text-slate">Connect an account once, then test it (read-only — never posts).</p>
        </div>
        <button type="submit" disabled={pending} className="btn-ghost disabled:opacity-50">
          {pending ? "Testing…" : "Test connections"}
        </button>
      </div>

      {/* Meta connect (Facebook Page + linked Instagram, one OAuth) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-line bg-paper/40 px-3 py-2.5">
        <span className="text-sm">
          <span className="font-semibold text-ink">Facebook + Instagram</span>{" "}
          {meta.connected ? <span className="text-field">· {meta.detail ?? "connected"}</span> : <span className="text-slate">· not connected</span>}
        </span>
        <span className="flex items-center gap-2">
          {/* Full-page nav to the API route, which 302s to the external OAuth
              consent — not a client-side page, so a plain anchor is correct. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/social/connect/facebook" className="rounded-sm border border-ink bg-ink px-2.5 py-1 text-xs font-semibold text-paper hover:opacity-90">
            {meta.connected ? "Reconnect" : "Connect"}
          </a>
          {meta.connected && (
            <button type="submit" formAction={disconnectAction} name="platform" value="facebook" className="rounded-sm border border-line px-2.5 py-1 text-xs font-semibold text-slate hover:border-brick hover:text-brick">
              Disconnect
            </button>
          )}
        </span>
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
