import { redirect } from "next/navigation";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { InviteForm } from "@/components/dashboard/InviteForm";
import { STAFF_ALLOWLIST, staffGate } from "@/lib/auth";
import { listStaff } from "@/lib/staff";
import { can, ROLES, ROLE_LABELS } from "@/lib/rbac";
import { revokeStaff, setMemberRole } from "./actions";

export const dynamic = "force-dynamic";

const roleBadge: Record<string, string> = {
  admin: "bg-brick/10 text-brick",
  captain: "bg-gold/15 text-[#9a6f1a]",
  organizer: "bg-field/10 text-field",
};

export default async function TeamPage() {
  const { role } = await staffGate();
  if (!can(role, "manageTeam")) redirect("/dashboard?denied=team");
  const invited = (await listStaff()).filter((s) => s.status === "active");

  return (
    <>
      <PageHeader kicker="Members" title="Team & access" />
      <HowTo
        steps={[
          "Anyone here can sign in to the War Room — everyone else is blocked, even with a Clerk account.",
          "Invite a teammate by email and pick a role: Organizer (field), Captain (field + read-only finance/donor totals), or Admin (everything).",
          "Change someone's access anytime with the role dropdown, then Update — it writes to their Clerk profile.",
          "The two admins in the server allowlist can't be changed or removed here — edit DASHBOARD_ALLOWLIST for those.",
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
              <li key={s.email} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="text-ink">{s.name ? `${s.name} · ` : ""}{s.email}</span>
                  {s.invitedBy && <span className="block text-[0.65rem] text-slate">invited by {s.invitedBy}</span>}
                </span>
                <form action={setMemberRole} className="flex items-center gap-2">
                  <input type="hidden" name="email" value={s.email} />
                  <select
                    name="role"
                    defaultValue={s.role}
                    aria-label={`Role for ${s.email}`}
                    className={`rounded-sm border border-line px-2 py-1 text-xs ${roleBadge[s.role] ?? ""}`}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <button type="submit" className="rounded-sm border border-line px-2.5 py-1 text-xs text-slate hover:border-ink hover:text-ink">Update</button>
                </form>
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
