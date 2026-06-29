// Phase 2 — automated, role-targeted STAFF notifications. Small best-effort helpers that fire
// when something happens (new issue, new volunteer, new donation, role change) and email the
// relevant role-holders. Modeled on lib/events/notify.ts: every function self-guards on
// sesEnabled and swallows errors so a notify can NEVER fail the underlying write.
//
// Recipient resolution: for INTERNAL staff alerts we read the durable DynamoDB staff store
// (listStaff) + the env DASHBOARD_ALLOWLIST (bootstrap admins) — cheap and reliable, vs. the
// Phase-1 Clerk scan (which is for broadcast targeting of ALL accounts incl. external tiers).
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { renderEmail, renderText } from "@/lib/email/layout";
import { listStaff } from "@/lib/staff";
import { STAFF_ALLOWLIST } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { emailsMuting } from "@/lib/notifications/prefs";

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Active staff emails for the given roles, from the staff store — unioned with the env allowlist
 * when "admin" is requested (bootstrap admins may not have a staff row), then MINUS anyone who
 * opted out of this notification `type` (Phase 3a). Lowercased, de-duped. Never throws.
 */
async function staffEmails(roles: Role[], type: string): Promise<string[]> {
  const want = new Set(roles);
  const out = new Set<string>();
  try {
    for (const s of await listStaff()) {
      if (s.status === "active" && want.has(s.role) && s.email) out.add(s.email.trim().toLowerCase());
    }
  } catch {
    /* DB unavailable → fall back to the allowlist below */
  }
  if (want.has("admin")) for (const e of STAFF_ALLOWLIST) if (e) out.add(e.trim().toLowerCase());
  const muted = await emailsMuting(type); // per-staffer opt-outs
  return [...out].filter((e) => !muted.has(e));
}

/** New issue-board submission → alert the moderators (admins + captains). Best-effort. */
export async function notifyModeratorsNewIssue(s: { topic: string; name?: string; city?: string }): Promise<void> {
  if (!sesEnabled) return;
  try {
    const to = await staffEmails(["admin", "captain"], "issue_moderation");
    if (!to.length) return;
    const from = [s.name, s.city].filter(Boolean).join(", ");
    const title = "New issue topic to moderate";
    await sendEmail({
      to,
      subject: `Issue board: "${s.topic.replace(/[\r\n]+/g, " ").slice(0, 60)}" awaiting review`,
      html: renderEmail({
        eyebrow: "Moderation",
        title,
        bodyHtml: `<p>A supporter submitted a topic to the public issue board.</p>
          <p style="margin:14px 0;padding:12px 16px;background:#F1EFE8;border-radius:4px;"><strong>${esc(s.topic)}</strong>${from ? `<br><span style="color:#5B6678;">from ${esc(from)}</span>` : ""}</p>
          <p>Approve, reject, or edit it on the dashboard <strong>Issue board</strong> (or in Airtable). It stays hidden from the public until approved.</p>`,
      }),
      text: renderText({ title, lines: [s.topic, from ? `From: ${from}` : "", "Review it on the dashboard Issue board."].filter(Boolean) }),
    });
  } catch {
    /* best-effort */
  }
}

/** New volunteer lead → alert captains to follow up. Best-effort. */
export async function notifyCaptainsNewVolunteer(v: { name?: string; email?: string; interests?: string }): Promise<void> {
  if (!sesEnabled) return;
  try {
    const to = await staffEmails(["captain"], "new_volunteer");
    if (!to.length) return;
    const title = "New volunteer to follow up";
    await sendEmail({
      to,
      subject: `New volunteer: ${v.name || "a supporter"}`,
      html: renderEmail({
        eyebrow: "Volunteers",
        title,
        bodyHtml: `<p>Someone just signed up to help.</p>
          <p style="margin:14px 0;padding:12px 16px;background:#F1EFE8;border-radius:4px;"><strong>${esc(v.name || "—")}</strong><br>
          <span style="color:#5B6678;">${esc(v.email || "no email")}${v.interests ? ` · ${esc(v.interests)}` : ""}</span></p>
          <p>Reach out and plug them in. Full record is on the dashboard <strong>Volunteers</strong> page.</p>`,
      }),
      text: renderText({ title, lines: [v.name || "—", v.email || "", v.interests || ""].filter(Boolean) }),
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Ping ONE captain that a volunteer on THEIR team raised their hand for a task
 * (from the community hub's matched-actions). A direct, low-volume, actionable
 * nudge — sent straight to that captain, not the role broadcast. Best-effort.
 */
export async function notifyCaptainVolunteerInterest(
  captainEmail: string,
  v: { name?: string; email?: string; task: string },
): Promise<void> {
  if (!sesEnabled || !captainEmail) return;
  try {
    const title = "A volunteer on your team is ready";
    await sendEmail({
      to: captainEmail,
      subject: `${v.name || "A volunteer"} is ready: ${v.task}`.slice(0, 120),
      html: renderEmail({
        eyebrow: "Your team",
        title,
        bodyHtml: `<p>Someone on your team just raised their hand for an action.</p>
          <p style="margin:14px 0;padding:12px 16px;background:#F1EFE8;border-radius:4px;"><strong>${esc(v.name || "—")}</strong>${v.email ? `<br><span style="color:#5B6678;">${esc(v.email)}</span>` : ""}<br><br>Interested in: <strong>${esc(v.task)}</strong></p>
          <p>Reach out and get them started. Their full profile is on the dashboard <strong>Volunteers</strong> page.</p>`,
      }),
      text: renderText({ title, lines: [`${v.name || "A volunteer"} — ${v.task}`, v.email || "", "Get them started from the dashboard Volunteers page."].filter(Boolean) }),
    });
  } catch {
    /* best-effort */
  }
}

/**
 * New team-captain application (from /join) → alert admins, who are the only ones who can promote
 * to the captain RBAC role. The applicant is saved as a normal volunteer with door="Team Captain";
 * this just surfaces it so it doesn't sit unseen. Best-effort.
 */
export async function notifyAdminsCaptainApplication(a: {
  name?: string;
  email?: string;
  city?: string;
  note?: string;
}): Promise<void> {
  if (!sesEnabled) return;
  try {
    const to = await staffEmails(["admin"], "captain_application");
    if (!to.length) return;
    const who = [a.name, a.city].filter(Boolean).join(", ");
    const title = "New team-captain application";
    await sendEmail({
      to,
      subject: `Captain application: ${a.name || "a volunteer"}`,
      html: renderEmail({
        eyebrow: "Team",
        title,
        bodyHtml: `<p>Someone applied to lead a team via the website.</p>
          <p style="margin:14px 0;padding:12px 16px;background:#F1EFE8;border-radius:4px;"><strong>${esc(a.name || "—")}</strong>${who && a.name ? `<br><span style="color:#5B6678;">${esc([a.city].filter(Boolean).join(""))}</span>` : ""}
          ${a.email ? `<br><span style="color:#5B6678;">${esc(a.email)}</span>` : ""}${a.note ? `<br><br>${esc(a.note)}` : ""}</p>
          <p>Find them on the dashboard <strong>Volunteers</strong> page (filter “Captain applicants”). To approve, assign them the <strong>Captain</strong> role on the <strong>Team</strong> page.</p>`,
      }),
      text: renderText({
        title,
        lines: [a.name || "—", a.city || "", a.email || "", a.note || "", "Review on the dashboard Volunteers page; promote on the Team page."].filter(Boolean),
      }),
    });
  } catch {
    /* best-effort */
  }
}

/** New donation → notify admins (the donor thank-you is sent separately by the webhook). Best-effort. */
export async function notifyAdminsNewDonation(d: { name?: string; amount?: number; email?: string; city?: string; recurring?: boolean }): Promise<void> {
  if (!sesEnabled) return;
  try {
    const to = await staffEmails(["admin"], "new_donation");
    if (!to.length) return;
    const amt = typeof d.amount === "number" ? `$${d.amount.toFixed(2)}` : "a contribution";
    const title = "New contribution received";
    await sendEmail({
      to,
      subject: `New donation: ${amt}${d.name ? ` from ${d.name}` : ""}${d.recurring ? " (recurring)" : ""}`,
      html: renderEmail({
        eyebrow: "Fundraising",
        title,
        bodyHtml: `<p>A new contribution just came in via WinRed.</p>
          <p style="margin:14px 0;padding:12px 16px;background:#F1EFE8;border-radius:4px;"><strong>${esc(amt)}</strong>${d.recurring ? " · recurring" : ""}<br>
          <span style="color:#5B6678;">${esc(d.name || "—")}${d.city ? ` · ${esc(d.city)}` : ""}${d.email ? ` · ${esc(d.email)}` : ""}</span></p>
          <p>The donor was thanked automatically. Details are on the dashboard <strong>Donors</strong> page.</p>`,
      }),
      text: renderText({ title, lines: [amt + (d.recurring ? " (recurring)" : ""), d.name || "", d.email || ""].filter(Boolean) }),
    });
  } catch {
    /* best-effort */
  }
}

// Per-role "here's your access" copy for the team-onboarding welcome.
const ROLE_WELCOME: Partial<Record<Role, string>> = {
  admin: "You have full access — fundraising, compliance, donors, broadcasts, events, and team management.",
  captain: "You're a field leader: organizing, content, research, events, and read-only finance & donor totals. You can draft email/SMS (an admin sends).",
  volunteer: "You're set for field & content: volunteers, tasks, the map, and graphics.",
  partner: "You have access to the shared Peace Room to collaborate on the case for change.",
};

/**
 * Email a staffer a role-specific "here's what you can do" welcome when their role is assigned
 * or changed. Best-effort; safe to call only when the role actually changed.
 */
export async function sendRoleWelcome(email: string, role: Role, firstName?: string): Promise<void> {
  if (!sesEnabled || !email) return;
  try {
    const blurb = ROLE_WELCOME[role] ?? `You've been added to the team as ${ROLE_LABELS[role]}.`;
    const title = `You're set up as ${ROLE_LABELS[role]}`;
    await sendEmail({
      to: email,
      subject: `Your ${ROLE_LABELS[role]} access — Matt Grant for Congress`,
      html: renderEmail({
        eyebrow: "Team access",
        title,
        bodyHtml: `<p>Hi ${esc(firstName || "there")},</p>
          <p>${esc(blurb)}</p>
          <p>Sign in to the campaign dashboard to get started. Welcome aboard.</p>`,
      }),
      text: renderText({ title, lines: [blurb, "Sign in to the campaign dashboard to get started."] }),
    });
  } catch {
    /* best-effort */
  }
}
