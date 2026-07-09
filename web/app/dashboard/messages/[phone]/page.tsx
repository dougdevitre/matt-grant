import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import { MessageThread } from "@/components/dashboard/MessageThread";
import { toE164 } from "@/lib/sms/send";
import { consentStatus } from "@/lib/sms/consent";
import { isBlocked } from "@/lib/sms/moderation";
import { getThread, getConversation, markRead, decideCanSend } from "@/lib/sms/conversations";
import { getVolunteers } from "@/lib/queries";
import { listStaffContacts } from "@/lib/clerkAudiences";
import { ROLE_LABELS } from "@/lib/rbac";
import { blockNumberAction, unblockNumberAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ phone: string }> }) {
  const { role } = await staffGate();
  if (!can(role, "messageIndividuals")) redirect("/dashboard?denied=messageIndividuals");

  const { phone: raw } = await params;
  const phone = toE164(decodeURIComponent(raw));
  if (!phone) notFound();

  const [messages, status, convo, blocked, vols, staffContacts] = await Promise.all([
    getThread(phone),
    consentStatus(phone),
    getConversation(phone),
    isBlocked(phone),
    getVolunteers(),
    listStaffContacts(),
  ]);
  await markRead(phone); // opening the thread clears its unread count

  const vol = vols.rows.find((v) => toE164(v.phone) === phone);
  // If this number belongs to a teammate, surface their role so an internal thread
  // reads as "Jordan · Captain", not a bare number. Volunteer name wins for the label.
  const staff = staffContacts.find((s) => s.phone && toE164(s.phone) === phone);
  const name = vol?.name ?? staff?.firstName ?? staff?.email ?? undefined;
  const decision = decideCanSend({ blocked, consentStatus: status, hasInbound: !!convo?.hasInbound });

  // Person-initiated threads are reply-able even without a broadcast opt-in — say so plainly
  // instead of a bare "Not opted in" that reads like "can't message." Reserve opted-in/out
  // language for broadcast eligibility.
  const consentLabel =
    status === "opted_in"
      ? "Opted in"
      : status === "opted_out"
        ? "Opted out"
        : convo?.hasInbound
          ? "Texted us first · can reply"
          : "Not opted in";
  const consentClass = status === "opted_out" ? "bg-brick/10 text-brick" : convo?.hasInbound || status === "opted_in" ? "bg-field/10 text-field" : "bg-paper";

  return (
    <>
      <Link href="/dashboard/messages" className="font-mono text-xs uppercase tracking-eyebrow text-slate hover:text-ink">
        ← Inbox
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{name ?? phone}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate">
            {name && <span className="font-mono text-xs">{phone}</span>}
            {staff && (
              <span className="rounded-sm bg-gold/15 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-gold-ink">
                Team · {ROLE_LABELS[staff.role]}
              </span>
            )}
            <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${consentClass}`}>{consentLabel}</span>
            {blocked && <span className="rounded-sm bg-brick/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-brick">Blocked</span>}
            {convo?.linkedEmail && (
              <span className="rounded-sm bg-field/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-field">
                Registered · supporter
              </span>
            )}
          </p>
        </div>

        {/* Moderation: block / unblock */}
        {blocked ? (
          <form action={unblockNumberAction}>
            <input type="hidden" name="phone" value={phone} />
            <button type="submit" className="rounded-sm border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink">
              Unblock
            </button>
          </form>
        ) : (
          <form action={blockNumberAction}>
            <input type="hidden" name="phone" value={phone} />
            <ConfirmButton
              message={`Block ${phone}? Their inbound texts will be ignored and you won't be able to message them.`}
              className="rounded-sm border border-line px-3 py-1.5 text-xs font-semibold text-brick hover:border-brick"
            >
              Block
            </ConfirmButton>
          </form>
        )}
      </div>

      <MessageThread
        phone={phone}
        messages={messages}
        canSend={decision.allowed}
        blockReason={decision.reason}
        optedOut={status === "opted_out"}
        registeredEmail={convo?.linkedEmail}
        prefillEmail={vol?.email ?? undefined}
        prefillName={name}
      />
    </>
  );
}
