"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replyMessage, registerTexter, type MsgState } from "@/app/dashboard/messages/actions";
import type { SmsMessage } from "@/lib/sms/conversations";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-field";

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

export function MessageThread({
  phone,
  messages,
  canSend,
  blockReason,
  registeredEmail,
  prefillEmail,
  prefillName,
}: {
  phone: string;
  messages: SmsMessage[];
  canSend: boolean;
  blockReason?: string;
  registeredEmail?: string;
  prefillEmail?: string;
  prefillName?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [reply, setReply] = useState<MsgState | null>(null);
  const [reg, setReg] = useState<MsgState | null>(null);
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [showReg, setShowReg] = useState(false);
  const [pending, start] = useTransition();

  const sendReply = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("phone", phone);
      fd.set("body", body);
      const res = await replyMessage(fd);
      setReply(res);
      if (res.ok) {
        setBody("");
        router.refresh();
      }
    });

  const doRegister = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("phone", phone);
      fd.set("email", email);
      if (prefillName) fd.set("name", prefillName);
      const res = await registerTexter(fd);
      setReg(res);
      if (res.ok) router.refresh();
    });

  return (
    <div className="card p-6">
      {/* Thread */}
      <div className="space-y-3">
        {messages.length === 0 && <p className="text-sm text-slate">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.direction === "out" ? "bg-ink text-paper" : "border border-line bg-paper text-ink"}`}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className={`mt-1 font-mono text-[0.6rem] ${m.direction === "out" ? "text-paper/60" : "text-slate"}`}>
                {when(m.createdAt)}
                {m.direction === "out" && m.status === "failed" && <span className="ml-1 text-brick">· failed</span>}
                {m.flagged && <span className="ml-1 text-brick">· ⚠ flagged</span>}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply */}
      <div className="mt-6 border-t border-line pt-4">
        {canSend ? (
          <>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className={field}
              placeholder="Write a reply…"
              aria-label="Reply message"
            />
            <div className="mt-2 flex items-center gap-3">
              <button onClick={sendReply} disabled={pending || !body.trim()} className="btn-primary disabled:opacity-50">
                {pending ? "Sending…" : "Send"}
              </button>
              {reply && <span className={`text-sm ${reply.ok ? "text-field" : "text-brick"}`}>{reply.message}</span>}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate">{blockReason ?? "You can't message this number right now."}</p>
        )}
      </div>

      {/* Register as supporter */}
      <div className="mt-6 border-t border-line pt-4">
        {registeredEmail ? (
          <p className="text-sm text-slate">
            Registered as a community supporter — <span className="font-mono text-xs">{registeredEmail}</span>.
          </p>
        ) : showReg ? (
          <div>
            <p className="text-xs font-semibold text-slate">Register as a community supporter</p>
            <p className="mt-1 text-xs text-slate">Needs their real email — accounts can&apos;t be created from a phone number alone.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className={`${field} max-w-xs`}
                placeholder="name@example.com"
                aria-label="Supporter email"
              />
              <button onClick={doRegister} disabled={pending || !email.includes("@")} className="btn-ghost disabled:opacity-50">
                {pending ? "Registering…" : "Register"}
              </button>
              {reg && <span className={`text-sm ${reg.ok ? "text-field" : "text-brick"}`}>{reg.message}</span>}
            </div>
          </div>
        ) : (
          <button onClick={() => setShowReg(true)} className="text-sm text-field underline hover:text-ink">
            Register as a community supporter →
          </button>
        )}
      </div>
    </div>
  );
}
