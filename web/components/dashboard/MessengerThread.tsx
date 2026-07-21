"use client";

import { useState, useTransition } from "react";
import { replyMessengerMessage, type MsgrActionState } from "@/app/dashboard/messages/social/actions";

type Bubble = { direction: "in" | "out"; body: string; createdAt: string; status?: string; flagged?: boolean };

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-field";

// 1:1 Meta thread (Facebook Messenger / Instagram DM). Human reply only — gated on
// Meta's 24h window server-side; the composer is disabled with a reason when closed.
export function MessengerThread({
  messengerKey,
  channel,
  messages,
  canReply,
  reason,
  windowEndsAt,
}: {
  messengerKey: string;
  channel: "Messenger" | "Instagram";
  messages: Bubble[];
  canReply: boolean;
  reason?: string;
  windowEndsAt?: string;
}) {
  const [body, setBody] = useState("");
  const [res, setRes] = useState<MsgrActionState | null>(null);
  const [pending, start] = useTransition();

  const send = () => {
    const fd = new FormData();
    fd.set("key", messengerKey);
    fd.set("body", body);
    start(async () => {
      const r = await replyMessengerMessage(fd);
      setRes(r);
      if (r.ok) setBody("");
    });
  };

  const windowNote =
    canReply && windowEndsAt
      ? `Meta reply window open until ${new Date(windowEndsAt).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} CT`
      : null;

  return (
    <div className="card p-6">
      <div className="flex flex-col gap-2">
        {messages.length === 0 && <p className="text-sm text-slate">No messages yet.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                m.direction === "out" ? "bg-field/10 text-ink" : "bg-paper text-ink"
              }`}
            >
              {m.flagged && <span className="mr-1" title="Flagged for review">⚠</span>}
              <span className="whitespace-pre-wrap">{m.body}</span>
              <span className="mt-1 block font-mono text-[0.6rem] text-slate">
                {new Date(m.createdAt).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {m.direction === "out" && m.status === "failed" ? " · failed" : ""}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        {canReply ? (
          <>
            <label className="text-xs font-semibold text-slate" htmlFor="msgr-reply">
              Reply on {channel}
            </label>
            <textarea
              id="msgr-reply"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={`${field} mt-1 min-h-20`}
              placeholder={`Write a reply — it sends as the campaign Page on ${channel}.`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={send}
                disabled={pending || !body.trim()}
                className="btn-primary disabled:opacity-50"
              >
                {pending ? "Sending…" : `Send on ${channel}`}
              </button>
              {windowNote && <span className="text-xs text-slate">{windowNote}</span>}
            </div>
          </>
        ) : (
          <p className="rounded-sm border border-gold/50 bg-gold/10 px-4 py-3 text-sm text-ink">
            {reason ?? "You can't reply to this conversation right now."}
          </p>
        )}
        {res && <p className={`mt-2 text-sm ${res.ok ? "text-field" : "text-brick"}`}>{res.message}</p>}
      </div>
    </div>
  );
}
