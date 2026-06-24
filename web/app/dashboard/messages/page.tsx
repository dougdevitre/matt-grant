import { redirect } from "next/navigation";
import Link from "next/link";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { smsEnabled, toE164 } from "@/lib/sms/send";
import { listConversations } from "@/lib/sms/conversations";
import { listConsent } from "@/lib/sms/consent";
import { listBlocked } from "@/lib/sms/moderation";
import { getVolunteers } from "@/lib/queries";
import { NewMessageForm } from "@/components/dashboard/NewMessageForm";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const { role } = await staffGate();
  if (!can(role, "messageIndividuals")) redirect("/dashboard?denied=messageIndividuals");

  const [convos, consent, blocked, vols, enabled] = await Promise.all([
    listConversations(),
    listConsent(),
    listBlocked(),
    getVolunteers(),
    smsEnabled(),
  ]);

  const statusByPhone = new Map(consent.map((c) => [c.phone, c.status]));
  const blockedSet = new Set(blocked.map((b) => b.phone));
  const nameByPhone = new Map<string, string>();
  for (const v of vols.rows) {
    const e = toE164(v.phone);
    if (e && !nameByPhone.has(e)) nameByPhone.set(e, v.name);
  }
  // Quick-pick contacts for a new conversation: opted-in, non-blocked volunteers
  // (cold initiation is only allowed to opted-in numbers).
  const contacts = vols.rows
    .map((v) => ({ name: v.name, phone: toE164(v.phone) }))
    .filter((c): c is { name: string; phone: string } => !!c.phone && statusByPhone.get(c.phone) === "opted_in" && !blockedSet.has(c.phone));

  const when = (iso: string) =>
    iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

  return (
    <>
      <PageHeader kicker="Comms" title="Inbox" />
      <HowTo
        steps={[
          "This is 1:1 texting — separate from broadcast Text blasts. Replies from people land here as threads.",
          "You can reply to anyone who texted the campaign first, and start new texts to opted-in supporters. Opted-out (STOP) and blocked numbers are refused.",
          "A ⚠ badge flags inappropriate language for your review — it does NOT auto-block. Use Block on a thread to stop an abusive number.",
          "Register a texter as a community supporter from their thread (needs their real email).",
        ]}
      />

      {!enabled && (
        <div className="mb-6 rounded-sm border border-gold/50 bg-gold/10 px-5 py-4 text-sm text-ink">
          <p className="font-semibold">Texting isn&apos;t configured yet.</p>
          <p className="mt-1 text-slate">Add the Twilio credentials in SSM to send and receive. You can still browse threads here.</p>
        </div>
      )}

      <NewMessageForm contacts={contacts} disabled={!enabled} />

      <div className="mt-8">
        <p className="eyebrow text-slate">Conversations</p>
        {convos.length > 0 ? (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {convos.map((c) => {
              const isBlocked = blockedSet.has(c.phone);
              const status = statusByPhone.get(c.phone);
              return (
                <li key={c.phone}>
                  <Link
                    href={`/dashboard/messages/${encodeURIComponent(c.phone)}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-paper"
                  >
                    <span className="min-w-0">
                      <span className="font-semibold text-ink">{nameByPhone.get(c.phone) ?? c.phone}</span>
                      {nameByPhone.has(c.phone) && <span className="ml-2 font-mono text-xs text-slate">{c.phone}</span>}
                      <span className="mt-0.5 block truncate text-slate">
                        {c.lastDirection === "out" ? "↳ " : ""}
                        {c.lastBody || "—"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {c.unread > 0 && (
                        <span className="rounded-full bg-brick px-1.5 py-0.5 font-mono text-[0.6rem] font-bold text-paper">{c.unread}</span>
                      )}
                      {c.flaggedCount > 0 && <span title="Flagged language">⚠️</span>}
                      {isBlocked && (
                        <span className="rounded-sm bg-brick/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-brick">blocked</span>
                      )}
                      {status === "opted_out" && !isBlocked && (
                        <span className="rounded-sm bg-gold/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-[#9a6f1a]">opted out</span>
                      )}
                      <span className="font-mono text-[0.65rem] text-slate">{when(c.lastAt)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate">No conversations yet. Inbound texts and 1:1 messages you send will show up here.</p>
        )}
      </div>
    </>
  );
}
