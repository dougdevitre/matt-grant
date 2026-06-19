"use client";

import { useState, useTransition } from "react";
import { sendTestCampaign, sendCampaign, type SendState, type Audience } from "@/app/dashboard/emails/actions";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink";

export function EmailComposer({
  counts,
  canSend,
  disabled,
}: {
  counts: { volunteers: number; donors: number };
  canSend: boolean;
  disabled: boolean;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [res, setRes] = useState<SendState | null>(null);
  const [pending, start] = useTransition();

  const audienceCount =
    audience === "volunteers" ? counts.volunteers : audience === "donors" ? counts.donors : counts.volunteers + counts.donors;

  const fd = () => {
    const f = new FormData();
    f.set("subject", subject);
    f.set("body", body);
    f.set("audience", audience);
    return f;
  };
  const run = (action: (f: FormData) => Promise<SendState>) => start(async () => setRes(await action(fd())));

  return (
    <div className="card p-6">
      <p className="eyebrow text-brick">Compose a broadcast</p>
      <div className="mt-4 space-y-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject line"
          className={field}
          aria-label="Subject"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"Write your message. Blank lines start new paragraphs.\n\nEvery email automatically includes the committee address, the “Paid for by” line, and a working unsubscribe link."}
          rows={10}
          className={`${field} resize-y`}
          aria-label="Body"
        />
        <div className="flex flex-wrap items-center gap-3">
          <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className={`${field} w-auto`} aria-label="Audience">
            <option value="all">Everyone</option>
            <option value="volunteers">Volunteers</option>
            <option value="donors">Donors</option>
          </select>
          <span className="font-mono text-xs text-slate">
            ~{audienceCount} recipient{audienceCount === 1 ? "" : "s"} (before unsubscribes)
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || disabled}
          onClick={() => run(sendTestCampaign)}
          className="btn-ghost disabled:opacity-50"
        >
          {pending ? "Working…" : "Send test to me"}
        </button>
        {canSend && (
          <button
            type="button"
            disabled={pending || disabled}
            onClick={() => {
              if (confirm(`Send "${subject || "(no subject)"}" to ~${audienceCount} recipients? This cannot be undone.`)) run(sendCampaign);
            }}
            className="btn-primary disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send to list"}
          </button>
        )}
      </div>

      {res && (
        <p className={`mt-3 rounded-sm border px-3 py-2 text-sm ${res.ok ? "border-field/40 bg-field/10 text-field" : "border-brick/40 bg-brick/10 text-brick"}`}>
          {res.message}
        </p>
      )}
      {!canSend && (
        <p className="mt-3 text-xs text-slate">You can draft and send tests. Sending to the list is limited to admins.</p>
      )}
    </div>
  );
}
