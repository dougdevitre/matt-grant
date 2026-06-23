import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { getDashboardStatus, type StatusState } from "@/lib/dashboardStatus";

export const dynamic = "force-dynamic";

const BADGE: Record<StatusState, { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-field/15 text-field" },
  setup: { label: "Needs setup", cls: "bg-gold/20 text-ink" },
  off: { label: "Off", cls: "bg-line text-slate" },
};

// Admin-only "one place to see what's working" surface — consolidates the config
// state that's otherwise scattered across per-page banners.
export default async function SetupPage() {
  await requireCap("manageTeam");
  const rows = await getDashboardStatus();
  const live = rows.filter((r) => r.state === "live").length;

  return (
    <>
      <PageHeader kicker="Admin" title="Setup & status">
        <span className="rounded-sm bg-ink/5 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
          {live}/{rows.length} live
        </span>
      </PageHeader>
      <p className="mb-6 max-w-prose text-sm text-slate">
        One place to see what&rsquo;s wired up and what still needs attention. Each row shows whether a
        feature is live; follow the link to finish setting one up.
      </p>
      <HowTo
        steps={[
          "Scan the badges: green “Live” is working, gold “Needs setup” isn’t connected yet.",
          "Click a row’s link to jump to where you finish that setup.",
          "Secrets (API keys, Twilio, WinRed) are stored in AWS SSM — once set, they go live within a few minutes.",
          "“Off” means a core service (the database) isn’t connected and the dashboard is showing demo data.",
        ]}
      />
      <div className="card divide-y divide-line">
        {rows.map((r) => {
          const b = BADGE[r.state];
          return (
            <div key={r.key} className="flex flex-wrap items-center gap-3 p-4">
              <span className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${b.cls}`}>
                {b.label}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{r.label}</p>
                <p className="mt-0.5 text-xs text-slate">{r.detail}</p>
              </div>
              {r.actionHref && r.actionText && (
                <Link href={r.actionHref} className="shrink-0 font-mono text-xs font-bold text-brick hover:underline">
                  {r.actionText} →
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
