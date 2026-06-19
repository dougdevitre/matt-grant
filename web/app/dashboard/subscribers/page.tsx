import { redirect } from "next/navigation";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listSubscribers, TOPICS } from "@/lib/subscribers";

export const dynamic = "force-dynamic";

const topicLabel: Record<string, string> = Object.fromEntries(TOPICS.map((t) => [t.key, t.label]));
const statusStyle: Record<string, string> = {
  subscribed: "bg-field/10 text-field",
  unsubscribed: "bg-ink/10 text-slate",
  bounced: "bg-brick/10 text-brick",
  complained: "bg-brick/10 text-brick",
};

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
  const when = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
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

      <div className="card mt-6 overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-slate">No suppressions or opt-outs yet — everyone with an email is receiving broadcasts.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-paper text-left text-slate">
              <tr>
                <th className="px-5 py-3 font-mono text-xs uppercase tracking-eyebrow">Email</th>
                <th className="px-5 py-3 font-mono text-xs uppercase tracking-eyebrow">Status</th>
                <th className="px-5 py-3 font-mono text-xs uppercase tracking-eyebrow">Opted out of</th>
                <th className="px-5 py-3 text-right font-mono text-xs uppercase tracking-eyebrow">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.email} className="hover:bg-paper">
                  <td className="px-5 py-3 font-mono text-xs text-ink">{r.email}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${statusStyle[r.status] ?? "bg-ink/5 text-slate"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate">
                    {r.status === "subscribed" ? (r.optOut.length ? r.optOut.map((t) => topicLabel[t] ?? t).join(", ") : "—") : "all (global)"}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[0.65rem] text-slate">{when(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
