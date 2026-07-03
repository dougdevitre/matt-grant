import { redirect } from "next/navigation";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listSubscribers } from "@/lib/subscribers";
import { SubscriberTable } from "@/components/dashboard/SubscriberTable";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-6">
      <p className="eyebrow text-slate">{label}</p>
      <p className="mt-3 font-display text-4xl font-semibold text-ink">{value}</p>
    </div>
  );
}

export default async function SubscribersPage() {
  const { role } = await staffGate();
  if (!can(role, "manageTeam")) redirect("/dashboard?denied=subscribers");

  const rows = await listSubscribers(500);
  const counts = {
    unsubscribed: rows.filter((r) => r.status === "unsubscribed").length,
    bounced: rows.filter((r) => r.status === "bounced" || r.status === "complained").length,
    partial: rows.filter((r) => r.status === "subscribed" && r.optOut.length > 0).length,
  };

  return (
    <>
      <PageHeader kicker="Comms" title="Subscribers & suppression" />
      <HowTo
        steps={[
          "This is the preferences/suppression ledger — only people who unsubscribed, opted out of a topic, or bounced/complained appear here.",
          "Everyone else (donors/volunteers with an email) is implicitly subscribed and receives broadcasts.",
          "“unsubscribed”, “bounced”, and “complained” are skipped on every send; a topic opt-out is skipped only for that topic.",
          "Admin-only. People manage their own preferences via the unsubscribe link in any email.",
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Unsubscribed" value={counts.unsubscribed} />
        <Stat label="Bounced / complained" value={counts.bounced} />
        <Stat label="Partial opt-outs" value={counts.partial} />
      </div>

      {rows.length === 0 ? (
        <div className="card mt-6 overflow-hidden p-0">
          <p className="p-8 text-center text-slate">No suppressions or opt-outs yet — everyone with an email is receiving broadcasts.</p>
        </div>
      ) : (
        <div className="mt-6">
          <SubscriberTable rows={rows} />
        </div>
      )}
    </>
  );
}
