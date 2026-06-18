import { redirect } from "next/navigation";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { InviteForm } from "@/components/dashboard/InviteForm";
import { STAFF_ALLOWLIST, staffGate } from "@/lib/auth";
import { listStaff } from "@/lib/staff";
import { revokeStaff } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { role } = await staffGate();
  if (role !== "admin") redirect("/dashboard?denied=team");
  const invited = (await listStaff()).filter((s) => s.status === "active");

  return (
    <>
      <PageHeader kicker="Members" title="Team & access" />
      <HowTo
        steps={[
          "Anyone here can sign in to the War Room — everyone else is blocked, even with a Clerk account.",
          "Invite a teammate by email; they get access instantly and an email link (no redeploy).",
          "Admins from the server allowlist can't be removed here — change DASHBOARD_ALLOWLIST for those.",
          "Remove an invited member to revoke access immediately.",
        ]}
      />

      <InviteForm />

      <div className="mt-8">
        <p className="eyebrow text-slate">Who has access</p>

        {STAFF_ALLOWLIST.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {STAFF_ALLOWLIST.map((e) => (
              <li key={e} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-ink">{e}</span>
                <span className="rounded-sm bg-ink/5 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">Admin · env</span>
              </li>
            ))}
          </ul>
        )}

        {invited.length > 0 ? (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {invited.map((s) => (
              <li key={s.email} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">{s.name ? `${s.name} · ` : ""}{s.email}</span>
                  {s.invitedBy && <span className="block text-[0.65rem] text-slate">invited by {s.invitedBy}</span>}
                </span>
                <span className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${s.role === "admin" ? "bg-brick/10 text-brick" : "bg-field/10 text-field"}`}>{s.role}</span>
                <form action={revokeStaff}>
                  <input type="hidden" name="email" value={s.email} />
                  <button type="submit" className="rounded-sm border border-line px-2.5 py-1 text-xs text-brick hover:border-brick">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate">No invited teammates yet — add one above.</p>
        )}
      </div>
    </>
  );
}
