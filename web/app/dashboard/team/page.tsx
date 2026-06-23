import { redirect } from "next/navigation";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { InviteForm } from "@/components/dashboard/InviteForm";
import { PartnerInviteForm } from "@/components/dashboard/PartnerInviteForm";
import { STAFF_ALLOWLIST, staffGate } from "@/lib/auth";
import { listStaff } from "@/lib/staff";
import { listAccessChanges } from "@/lib/audit";
import { can, INVITABLE_ROLES, ROLE_LABELS } from "@/lib/rbac";
import { revokeStaff, setMemberRole } from "./actions";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import { SubmitButton } from "@/components/dashboard/SubmitButton";

const actionLabel: Record<string, string> = {
  invite: "invited",
  role_change: "changed role",
  revoke: "removed",
};

export const dynamic = "force-dynamic";

const roleBadge: Record<string, string> = {
  admin: "bg-brick/10 text-brick",
  captain: "bg-gold/15 text-[#9a6f1a]",
  member: "bg-field/10 text-field",
  partner: "bg-ink/5 text-slate",
};

export default async function TeamPage() {
  const { role } = await staffGate();
  if (!can(role, "manageTeam")) redirect("/dashboard?denied=team");
  const active = (await listStaff()).filter((s) => s.status === "active");
  const invited = active.filter((s) => s.role !== "partner"); // internal team
  const partners = active.filter((s) => s.role === "partner"); // Peace Room only
  const changes = await listAccessChanges(25);
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <>
      <PageHeader kicker="Members" title="Team & access" />
      <HowTo
        steps={[
          "Invite a teammate by email and pick a role: Member (field), Captain (field + read-only finance/donor totals), or Admin (everything).",
          "They get a Clerk invitation email and their role is applied when they accept — so this works even with sign-up locked to invitation-only.",
          "Change someone's access anytime with the role dropdown, then Update — it writes through to their Clerk profile.",
          "The two admins in the server allowlist can't be changed or removed here — edit DASHBOARD_ALLOWLIST for those.",
          "Remove an invited member to revoke access immediately. Every change is logged below.",
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
                    {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <SubmitButton pendingText="Saving…" className="rounded-sm border border-line px-2.5 py-1 text-xs text-slate hover:border-ink hover:text-ink disabled:opacity-50">Update</SubmitButton>
                </form>
                <form action={revokeStaff}>
                  <input type="hidden" name="email" value={s.email} />
                  <ConfirmButton message={`Revoke access for ${s.email}? They'll be signed out immediately.`} className="rounded-sm border border-line px-3 py-1.5 text-xs text-brick hover:border-brick">Remove</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate">No invited teammates yet — add one above.</p>
        )}
      </div>

      <div className="mt-12 border-t border-line pt-8">
        <p className="eyebrow text-brick">Coalition partners</p>
        <p className="mt-1 max-w-2xl text-sm text-slate">
          Allied candidates and partners who join the shared Peace Room. They reach only the case-for-change
          board — never donors, finance, compliance, or internal campaign tools.
        </p>
        <div className="mt-4">
          <PartnerInviteForm />
        </div>
        {partners.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {partners.map((p) => (
              <li key={p.email} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="text-ink">{p.name ? `${p.name} · ` : ""}{p.email}</span>
                  {p.invitedBy && <span className="block text-[0.65rem] text-slate">invited by {p.invitedBy}</span>}
                </span>
                <span className={`rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${roleBadge.partner}`}>
                  Partner · Peace Room
                </span>
                <form action={revokeStaff}>
                  <input type="hidden" name="email" value={p.email} />
                  <ConfirmButton message={`Remove ${p.email} from the Peace Room? They'll lose access immediately.`} className="rounded-sm border border-line px-3 py-1.5 text-xs text-brick hover:border-brick">Remove</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <p className="eyebrow text-slate">Recent access changes</p>
        {changes.length > 0 ? (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {changes.map((c, i) => (
              <li key={`${c.at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">{c.actor}</span>{" "}
                  <span className="text-slate">{actionLabel[c.action] ?? c.action}</span>{" "}
                  <span className="text-ink">{c.target}</span>
                  {c.action === "role_change" && (
                    <span className="text-slate"> ({c.prevRole ?? "—"} → {c.role})</span>
                  )}
                  {c.action === "invite" && c.role && <span className="text-slate"> as {c.role}</span>}
                </span>
                <span className="shrink-0 font-mono text-[0.65rem] text-slate">{when(c.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate">No access changes recorded yet.</p>
        )}
      </div>
    </>
  );
}
