"use client";

import { useActionState, useState } from "react";
import { fillWeekAction, type ActionState } from "@/app/dashboard/social/actions";
import { CHANNELS, CHANNEL_IDS, type ChannelId } from "@/lib/social/channels";

// "Fill the week" — bulk-schedule the next N calendar posts onto each selected
// channel's best-time slots. The heavy lifting is the pure planner in
// lib/social/scheduler.ts (timezone-correct to US Central).
export function SocialAutoSchedule() {
  const [state, action, pending] = useActionState<ActionState, FormData>(fillWeekAction, { ok: false, message: "" });
  const [channels, setChannels] = useState<ChannelId[]>(["x", "facebook", "instagram"]);
  const toggle = (ch: ChannelId) => setChannels((c) => (c.includes(ch) ? c.filter((x) => x !== ch) : [...c, ch]));
  const input = "rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field";

  return (
    <form action={action} className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow text-slate">Auto-schedule · fill the week</p>
          <p className="mt-1 text-xs text-slate">Drops the next posts from the countdown calendar onto each channel&apos;s best-time slots.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {CHANNEL_IDS.map((ch) => {
          const on = channels.includes(ch);
          return (
            <button type="button" key={ch} onClick={() => toggle(ch)} className={`rounded-sm border px-3 py-1.5 text-xs font-semibold ${on ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink"}`}>
              {CHANNELS[ch].label}
            </button>
          );
        })}
      </div>
      {channels.map((ch) => (
        <input key={ch} type="hidden" name="channels" value={ch} />
      ))}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <span className="font-semibold">How many</span>
          <select name="count" defaultValue="7" className={input}>
            {[3, 5, 7, 10, 14].map((n) => (
              <option key={n} value={n}>
                {n} posts
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
          {pending ? "Scheduling…" : "Fill the week"}
        </button>
      </div>
      {state.message && <p className={`mt-3 text-sm ${state.ok ? "text-field" : "text-brick"}`}>{state.message}</p>}
    </form>
  );
}
