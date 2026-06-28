"use client";

import { useState } from "react";

// Optional post-game opt-in. Email is enough; a phone requires the explicit SMS
// consent checkbox (TCPA) and the API also re-checks it. Honest states: a 503 from
// an unconfigured capture target shows a neutral "unavailable" message, never a
// silent success.

export interface OptInFormProps {
  gameId: string;
  score: number;
  onSubmitted?: (channel: "email" | "sms") => void;
}

type Status = "idle" | "saving" | "done" | "error" | "unavailable";

export function OptInForm({ gameId, score, onSubmitted }: OptInFormProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  const canSubmit = (email.trim() !== "" || (phone.trim() !== "" && smsConsent)) && status !== "saving";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("saving");
    try {
      const res = await fetch("/api/games/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          score,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          smsConsent: phone.trim() ? smsConsent : undefined,
        }),
      });
      if (res.ok) {
        setStatus("done");
        onSubmitted?.(phone.trim() && smsConsent ? "sms" : "email");
      } else if (res.status === 503) {
        setStatus("unavailable");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return <p className="text-sm text-ink">Thanks — you’re on the list. We’ll be in touch.</p>;
  }
  if (status === "unavailable") {
    return <p className="text-sm text-slate">Opt-in isn’t available right now — thanks for playing.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-slate">Want campaign updates? (Optional)</p>
      <div>
        <label htmlFor="optin-email" className="eyebrow text-slate">
          Email
        </label>
        <input
          id="optin-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="optin-phone" className="eyebrow text-slate">
          Mobile (optional)
        </label>
        <input
          id="optin-phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm"
          placeholder="(314) 555-0199"
        />
      </div>
      {phone.trim() !== "" && (
        <label className="flex items-start gap-2 text-xs text-slate">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I agree to receive campaign text messages at this number. Message &amp; data rates may apply; reply STOP to
            opt out. Consent is not a condition of any purchase.
          </span>
        </label>
      )}
      {status === "error" && <p className="text-sm text-brick">Couldn’t save that — please try again.</p>}
      <button type="submit" disabled={!canSubmit} className="btn-ink disabled:opacity-50">
        {status === "saving" ? "Saving…" : "Keep me posted"}
      </button>
    </form>
  );
}
