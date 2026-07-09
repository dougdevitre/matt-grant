"use client";

import { useState, useTransition } from "react";
import { saveTextAlerts, type TextAlertsState } from "@/app/dashboard/notifications/actions";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-field";

// The signed-in staffer's OWN team-text opt-in. Entering your number + checking the box
// is your own consent (TCPA) — it writes the consent ledger the campaign texts against.
// Works before Twilio go-live: opting in now means you're reachable the moment texting
// flips on. `notLive` just shows a heads-up; it never blocks saving your preference.
export function TextAlertsPrefs({
  phone,
  optedIn,
  notLive,
}: {
  phone: string;
  optedIn: boolean;
  notLive: boolean;
}) {
  const [ph, setPh] = useState(phone);
  const [on, setOn] = useState(optedIn);
  const [res, setRes] = useState<TextAlertsState | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("phone", ph);
      fd.set("optIn", on ? "true" : "false");
      setRes(await saveTextAlerts(fd));
    });

  return (
    <div className="card mt-8 p-6">
      <p className="eyebrow text-brick">My text alerts</p>
      <p className="mt-2 text-sm text-slate">
        Get campaign team texts on your phone. Add your mobile and opt in — this is your own consent, so admins can&apos;t
        do it for you. You can opt out here or by replying <span className="font-mono">STOP</span> to any text.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate">Your mobile number</label>
          <input
            value={ph}
            onChange={(e) => setPh(e.target.value)}
            className={`${field} mt-1 max-w-xs`}
            placeholder="+13145551234"
            aria-label="Your mobile number"
            inputMode="tel"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-4 w-4" />
          Text me campaign team alerts
        </label>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={pending || !ph.trim()} className="btn-primary disabled:opacity-50">
            {pending ? "Saving…" : "Save"}
          </button>
          {res && <span className={`text-sm ${res.ok ? "text-field" : "text-brick"}`}>{res.message}</span>}
        </div>

        {notLive && (
          <p className="text-xs text-slate">
            Texting isn&rsquo;t live yet — your opt-in is saved and takes effect as soon as the campaign turns on texting.
          </p>
        )}
      </div>
    </div>
  );
}
