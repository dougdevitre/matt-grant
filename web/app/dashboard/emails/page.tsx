import { redirect } from "next/navigation";
import Link from "next/link";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { EmailComposer } from "@/components/dashboard/EmailComposer";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getDonors, getVolunteers } from "@/lib/queries";
import { sesEnabled } from "@/lib/email/send";
import { listCampaigns } from "@/lib/campaigns";
import { BROADCAST_META } from "@/lib/email/broadcasts";
import { segmentCounts, WAYS_TO_HELP, WAY_TARGET_LABELS } from "@/lib/profile";
import { ISSUE_AXES } from "@/lib/integrations/research/issues";

export const dynamic = "force-dynamic";

const ISSUE_LABEL: Record<string, string> = Object.fromEntries(ISSUE_AXES.map((a) => [a.id, a.label]));
const audienceLabel: Record<string, string> = { all: "Everyone", volunteers: "Volunteers", donors: "Donors" };
// History label: "issue:family-courts" → "Interested: Family courts"; "way:host" → "Help: Can host…".
const labelFor = (a: string) =>
  a.startsWith("issue:")
    ? `Interested: ${ISSUE_LABEL[a.slice(6)] ?? a.slice(6)}`
    : a.startsWith("way:")
      ? `Help: ${WAY_TARGET_LABELS[a.slice(4) as keyof typeof WAY_TARGET_LABELS] ?? a.slice(4)}`
      : (audienceLabel[a] ?? a);

export default async function EmailsPage() {
  const { role } = await staffGate();
  if (!can(role, "draftEmailCampaign")) redirect("/dashboard?denied=campaign");
  const canSend = can(role, "sendEmailCampaign");

  const [v, d, sent, segCounts] = await Promise.all([getVolunteers(), getDonors(), listCampaigns(15), segmentCounts()]);
  const counts = {
    volunteers: v.rows.filter((x) => x.email).length,
    donors: d.rows.filter((x) => x.email).length,
  };
  // Profile-driven targeting: by interest (priority) and by how they want to help.
  const segments = [
    ...ISSUE_AXES.map((a) => ({ value: `issue:${a.id}`, label: a.label, count: segCounts.issues[a.id] ?? 0, group: "By interest (supporters)" })),
    ...WAYS_TO_HELP.map((w) => ({ value: `way:${w}`, label: WAY_TARGET_LABELS[w], count: segCounts.ways[w] ?? 0, group: "By how they help (supporters)" })),
  ];
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <>
      <PageHeader kicker="Comms" title="Email campaigns">
        {canSend && (
          <Link href="/dashboard/subscribers" className="btn-ghost">
            Subscribers &amp; suppression →
          </Link>
        )}
      </PageHeader>
      <HowTo
        steps={[
          "Pick a branded template, fill any fields, choose an audience (volunteers, donors, or everyone), and send.",
          "Each template maps to a topic (news, issues, GOTV, fundraising, events). Recipients opted out of that topic — or unsubscribed/bounced — are skipped automatically.",
          "Every email auto-includes the committee address, the “Paid for by” disclaimer, and one-click unsubscribe — CAN-SPAM + FEC built in.",
          "Always “Send test to me” first to see how it looks before sending to the list.",
          "Drafting + tests are open to captains; sending to the list is admins only.",
        ]}
      />

      {!sesEnabled && (
        <div className="mb-6 rounded-sm border border-gold/50 bg-gold/10 px-5 py-4 text-sm text-ink">
          <p className="font-semibold">Sending isn&apos;t configured yet.</p>
          <p className="mt-1 text-slate">
            Set <code className="font-mono text-xs">SES_FROM</code> (verified SES identity) and move out of the SES
            sandbox to send. You can still draft here.
          </p>
        </div>
      )}

      <EmailComposer broadcasts={BROADCAST_META} counts={counts} segments={segments} canSend={canSend} disabled={!sesEnabled} />

      <div className="mt-8">
        <p className="eyebrow text-slate">Recent sends</p>
        {sent.length > 0 ? (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {sent.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">{c.subjectPreview}</span>{" "}
                  <span className="text-slate">
                    → {labelFor(c.audience)} · {c.sentCount}/{c.total} sent
                    {c.sentCount > 0 ? ` · ${c.delivered} delivered · ${c.opens} opens · ${c.clicks} clicks` : ""}
                    {c.suppressedCount ? ` · ${c.suppressedCount} skipped` : ""} · by {c.createdBy}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow ${
                      c.status === "sent"
                        ? "bg-field/10 text-field"
                        : c.status === "failed"
                          ? "bg-brick/10 text-brick"
                          : "bg-gold/15 text-[#9a6f1a]"
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
          <p className="mt-3 text-sm text-slate">No broadcasts sent yet.</p>
        )}
      </div>
    </>
  );
}
