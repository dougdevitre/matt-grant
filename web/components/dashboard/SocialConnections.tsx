"use client";

import { useActionState } from "react";
import { testConnectionsAction, disconnectAction, switchPageAction } from "@/app/dashboard/social/actions";
import { CHANNELS } from "@/lib/social/channels";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import type { ChannelStatus } from "@/lib/social/publish";
import type { ConnectPlatform } from "@/lib/social/connect-platforms";

export type ProviderSummary = {
  platform: ConnectPlatform;
  label: string;
  connected: boolean;
  detail?: string;
  expiresInDays?: number | null;
  pages?: { id: string; name?: string; active: boolean }[]; // Facebook multi-Page
};

const input = "rounded-sm border border-line bg-white px-2 py-1 text-xs text-ink focus:border-field";

export function SocialConnections({ providers }: { providers: ProviderSummary[] }) {
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

      <div className="mt-4 space-y-2">
        {providers.map((p) => (
          <div key={p.platform} className="rounded-sm border border-line bg-paper/40 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                <span className="font-semibold text-ink">{p.label}</span>{" "}
                {p.connected ? (
                  <span className="text-field">· {p.detail ?? "connected"}</span>
                ) : (
                  <span className="text-slate">· not connected</span>
                )}
                {p.connected && typeof p.expiresInDays === "number" && (
                  <span className={`ml-1 ${p.expiresInDays <= 7 ? "text-brick" : "text-slate"}`}>
                    · {p.expiresInDays <= 0 ? "expired — reconnect" : `expires in ${p.expiresInDays}d`}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                {/* Full-page nav to the API route, which 302s to the external OAuth
                    consent — not a client-side page, so a plain anchor is correct. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href={`/api/social/connect/${p.platform}`} className="rounded-sm border border-ink bg-ink px-2.5 py-1 text-xs font-semibold text-paper hover:opacity-90">
                  {p.connected ? "Reconnect" : "Connect"}
                </a>
                {p.connected && (
                  <ConfirmButton
                    message={`Disconnect ${p.label}? Auto-posting stops until you reconnect.`}
                    formAction={disconnectAction}
                    name="platform"
                    value={p.platform}
                    className="rounded-sm border border-line px-2.5 py-1 text-xs font-semibold text-slate hover:border-brick hover:text-brick"
                  >
                    Disconnect
                  </ConfirmButton>
                )}
              </span>
            </div>

            {/* Facebook: pick which Page to post as, when the account manages several. */}
            {p.platform === "facebook" && p.connected && p.pages && p.pages.length > 1 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">Posting as</span>
                <select aria-label="Facebook Page to post as" name="pageId" defaultValue={p.pages.find((g) => g.active)?.id} className={input}>
                  {p.pages.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name ?? g.id}
                    </option>
                  ))}
                </select>
                <button type="submit" formAction={switchPageAction} className="rounded-sm border border-line px-2 py-1 text-[0.65rem] font-semibold text-field hover:border-field">
                  Switch
                </button>
              </div>
            )}
          </div>
        ))}
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
