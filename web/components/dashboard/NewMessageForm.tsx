"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendNewMessage, type MsgState } from "@/app/dashboard/messages/actions";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-field";

// Start a 1:1 conversation. The quick-pick list is opted-in supporters (cold
// initiation is only allowed to opted-in numbers); a raw number also works if
// that person has texted us first.
export function NewMessageForm({ contacts, disabled }: { contacts: { name: string; phone: string }[]; disabled: boolean }) {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [res, setRes] = useState<MsgState | null>(null);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("to", to);
      fd.set("body", body);
      const r = await sendNewMessage(fd);
      setRes(r);
      if (r.ok && r.phone) router.push(`/dashboard/messages/${encodeURIComponent(r.phone)}`);
    });

  return (
    <details className="rounded-sm border border-line bg-paper/60 px-5 py-3">
      <summary className="cursor-pointer list-none font-mono text-xs uppercase tracking-eyebrow text-field">＋ New message</summary>
      <div className="mt-3 space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate">To</label>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            list="sms-contacts"
            className={`${field} mt-1 max-w-sm`}
            placeholder="+13145551234"
            aria-label="Recipient phone number"
          />
          <datalist id="sms-contacts">
            {contacts.map((c) => (
              <option key={c.phone} value={c.phone}>
                {c.name}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate">Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={`${field} mt-1`} placeholder="Write a message…" aria-label="Message" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={send} disabled={disabled || pending || !to.trim() || !body.trim()} className="btn-primary disabled:opacity-50">
            {pending ? "Sending…" : "Send"}
          </button>
          {res && <span className={`text-sm ${res.ok ? "text-field" : "text-brick"}`}>{res.message}</span>}
        </div>
      </div>
    </details>
  );
}
