"use client";

import { useActionState } from "react";
import type { NotificationTypeDef } from "@/lib/notifications/types";
import { saveNotificationPrefs, type PrefsResult } from "@/app/dashboard/notifications/actions";

// Per-staffer notification opt-outs. A checked box = subscribed; unchecked = muted. The form
// posts every relevant key (allTypes) + the checked ones (subscribed); the action diffs them.
export function NotificationPrefs({ types, muted }: { types: NotificationTypeDef[]; muted: string[] }) {
  const [res, action, pending] = useActionState<PrefsResult | null, FormData>(saveNotificationPrefs, null);
  const mutedSet = new Set(muted);

  if (types.length === 0) {
    return (
      <div className="card p-8 text-center text-slate">
        No automated notifications are sent to your role. Nothing to configure here.
      </div>
    );
  }

  return (
    <form action={action} className="card max-w-xl p-6">
      <p className="text-xs font-semibold text-slate">Email me when…</p>
      <div className="mt-3 space-y-3">
        {types.map((t) => (
          <label key={t.key} className="flex items-start gap-3">
            <input type="hidden" name="allTypes" value={t.key} />
            <input
              type="checkbox"
              name="subscribed"
              value={t.key}
              defaultChecked={!mutedSet.has(t.key)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{t.label}</span>
              <span className="block text-xs text-slate">{t.desc}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
          {pending ? "Saving…" : "Save preferences"}
        </button>
        {res && <span className={`text-xs ${res.ok ? "text-emerald-700" : "text-red-600"}`}>{res.message}</span>}
      </div>
      <p className="mt-4 text-xs text-slate">
        These control the automated alerts sent to you. Broadcast emails/texts and SMS quiet hours are managed separately.
      </p>
    </form>
  );
}
