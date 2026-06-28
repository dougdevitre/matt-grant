// Client-safe registry of the automated staff-notification types (Phase 2 triggers) that a
// staffer can opt out of (Phase 3a). No DB/server imports so the settings UI can render from it.
// `roles` = which roles receive that notification, so the settings page shows each staffer only
// the toggles relevant to them. Keep keys stable — they're persisted in each staffer's opt-outs.
import type { Role } from "@/lib/rbac";

export type NotificationTypeDef = {
  key: string;
  label: string;
  desc: string;
  roles: Role[]; // recipients of this notification
};

export const NOTIFICATION_TYPES: NotificationTypeDef[] = [
  {
    key: "issue_moderation",
    label: "New issue topic to moderate",
    desc: "When a supporter submits a topic to the public issue board.",
    roles: ["admin", "captain"],
  },
  {
    key: "new_volunteer",
    label: "New volunteer to follow up",
    desc: "When someone signs up to actively help.",
    roles: ["captain"],
  },
  {
    key: "new_donation",
    label: "New donation received",
    desc: "When a contribution comes in via WinRed.",
    roles: ["admin"],
  },
  {
    key: "captain_application",
    label: "New team-captain application",
    desc: "When someone applies to lead a team via /join — review and promote them.",
    roles: ["admin"],
  },
];

export type NotificationType = string;
export const NOTIFICATION_KEYS: string[] = NOTIFICATION_TYPES.map((t) => t.key);
export const isNotificationType = (v: unknown): v is string =>
  typeof v === "string" && NOTIFICATION_KEYS.includes(v);

/** The notification toggles relevant to a given role (for the per-staffer settings page). */
export function notificationTypesForRole(role: Role | null | undefined): NotificationTypeDef[] {
  if (!role) return [];
  return NOTIFICATION_TYPES.filter((t) => t.roles.includes(role));
}
