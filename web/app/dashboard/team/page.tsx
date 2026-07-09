import { redirect } from "next/navigation";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { InviteForm } from "@/components/dashboard/InviteForm";
import { PartnerInviteForm } from "@/components/dashboard/PartnerInviteForm";
import { RemindPendingButton } from "@/components/dashboard/RemindPendingButton";
import { ResendInviteButton } from "@/components/dashboard/ResendInviteButton";
import { InviteStatusBadge } from "@/components/dashboard/InviteStatusBadge";
import { STAFF_ALLOWLIST, staffGate, clerkEnabled } from "@/lib/auth";
import { listStaff } from "@/lib/staff";
import { listPendingInvites } from "@/lib/invites";
import { listAccessChanges, listPreviewSwitches } from "@/lib/audit";
import { listStaffContacts } from "@/lib/clerkAudiences";
import { listConsent } from "@/lib/sms/consent";
import { toE164 } from "@/lib/sms/send";
import { can, INVITABLE_ROLES, ROLE_LABELS, ROLE_BADGE, isStaffRole, type Role } from "@/lib/rbac";
import { revokeStaff, setMemberRole, setCaptainAreaAction } from "./actions";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { CaptainRegionsPicker } from "@/components/dashboard/CaptainRegionsPicker";
import { listRegions } from "@/lib/volunteers/regions";

const actionLabel: Record<string, string> = {
  invite: "invited",
  invite_reminder: "resent invite to",
  role_change: "changed role",
  revoke: "removed",
};

const previewLabel: Record<string, string> = {
  preview_enter: "previewed as",
  preview_exit: "exited preview of",
};

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { role } = await staffGate();
  if (!can(role, "manageTeam")) redirect("/dashboard?denied=team");
  const active = (await listStaff()).filter((s) => s.status === "active");
  const invited = active.filter((s) => isStaffRole(s.role)); // internal team
  const partners = active.filter((s) => s.role === "partner"); // Peace Room only
  const changes = await listAccessChanges(25);
  const previews = await listPreviewSwitches(25);
  // Canonical regions for the captain region picker (empty when Airtable is off).
  const regionOptions = (await listRegions()).map((r) => ({ name: r.name, level: r.level }));

  // Clerk is the source of truth for "not yet accepted": anyone still in the pending
  // list hasn't signed in. We join it against our staff rows at render — no extra DB
  // state — and also surface invites that exist only in Clerk (e.g. created in Clerk's
  // own dashboard) so the whole "hasn't signed in" cohort is visible and nudgeable.
  const pending = clerkEnabled ? await listPendingInvites() : [];
  const pendingSet = new Set(pending.map((p) => p.email.toLowerCase()));
  const accepted = (email: string) => (clerkEnabled ? !pendingSet.has(email.toLowerCase()) : true);
  const known = new Set(
    [...active.map((s) => s.email), ...partners.map((p) => p.email), ...STAFF_ALLOWLIST].map((e) => e.toLowerCase()),
  );
  const orphanPending = pending.filter((p) => !known.has(p.email.toLowerCase()));

  // Text reachability per teammate: their stored mobile (Clerk publicMetadata.phone,
  // set by their own "My text alerts" opt-in) joined to the SMS consent ledger. Admins
  // can SEE this but can't opt anyone in — consent is the staffer's own action (TCPA).
  const [staffContacts, consent] = await Promise.all([
    clerkEnabled ? listStaffContacts() : Promise.resolve([]),
    listConsent(),
  ]);
  const smsStatusByPhone = new Map(consent.map((c) => [c.phone, c.status]));
  const textStatusByEmail = new Map<string, { phone: string; optedIn: boolean }>();
  for (const c of staffContacts) {
    const e = c.phone ? toE164(c.phone) : null;
    if (!c.email || !e) continue;
    textStatusByEmail.set(c.email.toLowerCase(), { phone: e, optedIn: smsStatusByPhone.get(e) === "opted_in" });
  }
  const textBadge = (email: string) => {
    const t = textStatusByEmail.get(email.toLowerCase());
    if (!t) return null;
    return t.optedIn
      ? { label: "Texts on", cls: "bg-field/10 text-field" }
      : { label: "No text opt-in", cls: "bg-paper text-slate" };
  };

  const roleName = (r?: string) => (r ? (ROLE_LABELS[r as Role] ?? r) : "—");
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

      {clerkEnabled && (
        <div className="mt-6 card p-5">
          <p className="eyebrow text-slate">Pending invitations</p>
          <p className="mt-1 max-w-2xl text-sm text-slate">
            {pending.length} {pending.length === 1 ? "person hasn't" : "people haven't"} accepted yet. Resend to one
            person from their row below, or nudge everyone at once here — it&rsquo;s safe to click again, since anyone
            reminded in the last 48 hours is skipped.
          </p>
          <div className="mt-3">
            <RemindPendingButton pending={pending.length} />
          </div>
        </div>
      )}

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
                {clerkEnabled && <InviteStatusBadge accepted={accepted(s.email)} />}
                {clerkEnabled && !accepted(s.email) && <ResendInviteButton email={s.email} />}
                {(() => {
                  const t = textBadge(s.email);
                  return t ? (
                    <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${t.cls}`}>{t.label}</span>
                  ) : null;
                })()}
                <form action={setMemberRole} className="flex items-center gap-2">
                  <input type="hidden" name="email" value={s.email} />
                  <select
                    name="role"
                    defaultValue={s.role}
                    aria-label={`Role for ${s.email}`}
                    className={`rounded-sm border border-line px-2 py-1 text-xs ${ROLE_BADGE[s.role] ?? ""}`}
                  >
                    {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <SubmitButton pendingText="Saving…" className="rounded-sm border border-line px-2.5 py-1 text-xs text-slate hover:border-ink hover:text-ink disabled:opacity-50">Update</SubmitButton>
                </form>
                {s.role === "captain" && (
                  <>
                    <CaptainRegionsPicker email={s.email} options={regionOptions} selected={s.regions ?? []} />
                    <form action={setCaptainAreaAction} className="flex items-center gap-1.5" title="Legacy free-text coverage area — used only as a fallback when no regions are assigned">
                      <input type="hidden" name="email" value={s.email} />
                      <input
                        name="area"
                        defaultValue={s.area ?? ""}
                        placeholder="Area (fallback)"
                        aria-label={`Fallback coverage area for ${s.email}`}
                        className="w-28 rounded-sm border border-line px-2 py-1 text-xs text-ink"
                      />
                      <SubmitButton pendingText="…" className="rounded-sm border border-line px-2 py-1 text-xs text-slate hover:border-ink hover:text-ink disabled:opacity-50">Area</SubmitButton>
                    </form>
                  </>
                )}
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

      {orphanPending.length > 0 && (
        <div className="mt-8">
          <p className="eyebrow text-slate">Invited directly in Clerk · not on the team yet</p>
          <p className="mt-1 max-w-2xl text-sm text-slate">
            Open invitations created outside this page (e.g. in the Clerk dashboard) that haven&rsquo;t been accepted.
            They&rsquo;ll get a role and join a list above once they accept.
          </p>
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {orphanPending.map((p) => (
              <li key={p.email} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="text-ink">{p.email}</span>
                  <span className="block text-[0.65rem] text-slate">
                    {p.role ? `invited as ${roleName(p.role)} · ` : ""}
                    {p.createdAt ? `invited ${when(new Date(p.createdAt).toISOString())}` : ""}
                  </span>
                </span>
                <InviteStatusBadge accepted={false} />
                <ResendInviteButton email={p.email} />
              </li>
            ))}
          </ul>
        </div>
      )}

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
                {clerkEnabled && <InviteStatusBadge accepted={accepted(p.email)} />}
                {clerkEnabled && !accepted(p.email) && <ResendInviteButton email={p.email} />}
                <span className={`rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${ROLE_BADGE.partner}`}>
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

      <div className="mt-8">
        <p className="eyebrow text-slate">Recent role previews</p>
        <p className="mt-1 max-w-2xl text-xs text-slate">
          Admins can preview the dashboard as a lower role (the &ldquo;View as&rdquo; switcher in the header). Every
          switch is logged here.
        </p>
        {previews.length > 0 ? (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {previews.map((p, i) => (
              <li key={`${p.at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">{p.actor}</span>{" "}
                  <span className="text-slate">{previewLabel[p.action] ?? p.action}</span>{" "}
                  <span className="text-ink">{roleName(p.role)}</span>
                </span>
                <span className="shrink-0 font-mono text-[0.65rem] text-slate">{when(p.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate">No role previews recorded yet.</p>
        )}
      </div>
    </>
  );
}
