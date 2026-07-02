import { redirect } from "next/navigation";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { SmsComposer } from "@/components/dashboard/SmsComposer";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { smsEnabled } from "@/lib/sms/send";
import { smsAudienceCounts, SMS_GROUP_LABELS } from "@/lib/sms/audiences";
import { listSmsCampaigns } from "@/lib/sms/campaigns";
import { listSavedTemplates } from "@/lib/notifications/messageTemplates";

export const dynamic = "force-dynamic";

export default async function SmsPage() {
  const { role } = await staffGate();
  if (!can(role, "draftSms")) redirect("/dashboard?denied=sms");
  const canSend = can(role, "sendSms");

  const [counts, sent, enabled, saved] = await Promise.all([smsAudienceCounts(), listSmsCampaigns(15), smsEnabled(), listSavedTemplates("sms")]);
  const groups = [
    { value: "subscribers", label: SMS_GROUP_LABELS.subscribers, count: counts.subscribers },
    { value: "volunteers", label: SMS_GROUP_LABELS.volunteers, count: counts.volunteers },
  ];
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <>
      <PageHeader kicker="Comms" title="Text blasts" />
      <HowTo
        steps={[
          "Pick a template, fill any fields, and watch the live preview + segment counter (multi-segment texts cost more).",
          "Texts only go to numbers that have opted in (texted the keyword or checked the web consent box). The audience counts show how many that is.",
          "Every text includes the sender's name and “Reply STOP to opt out.” STOP is honored automatically, and the send respects quiet hours (9am–8pm CT).",
          "Always send a test to your own opted-in number first.",
          "Drafting + tests are open to captains; sending to the list is admins only.",
        ]}
      />

      {!enabled && (
        <div className="mb-6 rounded-sm border border-gold/50 bg-gold/10 px-5 py-4 text-sm text-ink">
          <p className="font-semibold">Texting isn&apos;t configured yet.</p>
          <p className="mt-1 text-slate">
            Add the Twilio credentials (account SID, auth token, messaging service) in SSM. You can still draft here.
            Carrier delivery also needs Toll-Free Verification approved.
          </p>
        </div>
      )}

      <SmsComposer groups={groups} saved={saved} canSend={canSend} disabled={!enabled} />

      <div className="mt-8">
        <p className="eyebrow text-slate">Recent sends</p>
        {sent.length > 0 ? (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {sent.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">{c.body.length > 60 ? `${c.body.slice(0, 60)}…` : c.body}</span>{" "}
                  <span className="text-slate">
                    → {c.audience} · {c.sentCount}/{c.total} sent
                    {c.skippedCount ? ` · ${c.skippedCount} skipped` : ""} · by {c.createdBy}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow ${
                      c.status === "sent"
                        ? "bg-field/10 text-field"
                        : c.status === "failed"
                          ? "bg-brick/10 text-brick"
                          : "bg-gold/15 text-gold-ink"
                    }`}
                  >
                    {c.status === "scheduled" ? "scheduled" : c.status === "queued" || c.status === "sending" ? "sending" : c.status}
                  </span>
                  <span className="font-mono text-[0.65rem] text-slate">
                    {c.status === "scheduled" && c.scheduledAt ? `→ ${when(c.scheduledAt)}` : when(c.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate">No text blasts sent yet.</p>
        )}
      </div>
    </>
  );
}
