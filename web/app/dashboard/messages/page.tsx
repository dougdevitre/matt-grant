import { redirect } from "next/navigation";
import { staffGate } from "@/lib/auth";
import { can, STAFF_ROLES, ROLE_LABELS } from "@/lib/rbac";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { smsEnabled, toE164 } from "@/lib/sms/send";
import { listConversations } from "@/lib/sms/conversations";
import { listConsent } from "@/lib/sms/consent";
import { listBlocked } from "@/lib/sms/moderation";
import { listClerkContactsByRole } from "@/lib/clerkAudiences";
import { getVolunteers } from "@/lib/queries";
import { NewMessageForm } from "@/components/dashboard/NewMessageForm";
import { InboxList, type InboxItem } from "@/components/dashboard/InboxList";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const { role } = await staffGate();
  if (!can(role, "messageIndividuals")) redirect("/dashboard?denied=messageIndividuals");

  const [convos, consent, blocked, vols, enabled, staffByRole] = await Promise.all([
    listConversations(),
    listConsent(),
    listBlocked(),
    getVolunteers(),
    smsEnabled(),
    // Team members (staff Clerk accounts) with a phone on file, so an admin can
    // start a 1:1 with a teammate without hand-typing a number. Same three roles
    // as the blast resolver; [] when Clerk isn't configured.
    Promise.all(STAFF_ROLES.map((r) => listClerkContactsByRole(r))),
  ]);

  const statusByPhone = new Map(consent.map((c) => [c.phone, c.status]));
  const blockedSet = new Set(blocked.map((b) => b.phone));
  const nameByPhone = new Map<string, string>();
  for (const v of vols.rows) {
    const e = toE164(v.phone);
    if (e && !nameByPhone.has(e)) nameByPhone.set(e, v.name);
  }
  // Quick-pick contacts for a new conversation: opted-in, non-blocked volunteers
  // AND team members (staff Clerk accounts with a phone). Cold initiation is only
  // allowed to opted-in numbers, so both sources are gated on the consent ledger.
  // Keyed by phone so a person who is both a volunteer and staff appears once — the
  // volunteer row (real name) wins over the staff label.
  const canText = (phone: string) => statusByPhone.get(phone) === "opted_in" && !blockedSet.has(phone);
  const byPhone = new Map<string, { name: string; phone: string }>();
  for (const v of vols.rows) {
    const e = toE164(v.phone);
    if (e && canText(e) && !byPhone.has(e)) byPhone.set(e, { name: v.name, phone: e });
  }
  for (let i = 0; i < STAFF_ROLES.length; i++) {
    for (const s of staffByRole[i]) {
      const e = s.phone ? toE164(s.phone) : null;
      if (!e || byPhone.has(e) || !canText(e)) continue;
      byPhone.set(e, { name: `${s.firstName ?? s.email ?? e} · ${ROLE_LABELS[STAFF_ROLES[i]]}`, phone: e });
    }
  }
  const contacts = [...byPhone.values()];

  // Serializable rows for the client list (multi-select triage lives there).
  const items: InboxItem[] = convos.map((c) => ({
    phone: c.phone,
    name: nameByPhone.get(c.phone),
    lastBody: c.lastBody,
    lastDirection: c.lastDirection,
    lastAt: c.lastAt,
    unread: c.unread,
    flaggedCount: c.flaggedCount,
    blocked: blockedSet.has(c.phone),
    optedOut: statusByPhone.get(c.phone) === "opted_out",
  }));

  return (
    <>
      <PageHeader kicker="Comms" title="Inbox" />
      <HowTo
        steps={[
          "This is 1:1 texting — separate from broadcast Text blasts. Replies from people land here as threads.",
          "You can reply to anyone who texted the campaign first, and start new texts to opted-in supporters or team members (the New message picker lists both). Opted-out (STOP) and blocked numbers are refused.",
          "A ⚠ badge flags inappropriate language for your review — it does NOT auto-block. Use Block on a thread to stop an abusive number.",
          "Turn a texter into a community supporter from their thread — text them a self-signup link, or register them by email.",
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
        <InboxList items={items} />
      </div>
    </>
  );
}
