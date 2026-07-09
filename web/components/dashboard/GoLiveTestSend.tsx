"use client";

import { useState, useTransition } from "react";
import { sendGoLiveTest, type GoLiveTestState } from "@/app/dashboard/sms/go-live/actions";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-field";

// One-click smoke test from the console — the UI equivalent of the curl /api/sms/test
// step in the runbook. The number must already be opted in (the action enforces it).
export function GoLiveTestSend({ disabled }: { disabled: boolean }) {
  const [to, setTo] = useState("");
  const [res, setRes] = useState<GoLiveTestState | null>(null);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("to", to);
      setRes(await sendGoLiveTest(fd));
    });

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={`${field} max-w-xs`}
          placeholder="+13145551234"
          aria-label="Test recipient phone number"
          inputMode="tel"
        />
        <button type="button" onClick={send} disabled={disabled || pending || !to.trim()} className="btn-ghost disabled:opacity-50">
          {pending ? "Sending…" : "Send test text"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate">
        The number must already be opted in — text the keyword to the campaign number first.
      </p>
      {res && <p className={`mt-1 text-sm ${res.ok ? "text-field" : "text-brick"}`}>{res.message}</p>}
    </div>
  );
}
