// Single source of truth for the campaign Chrome extension's public-facing facts
// and its "is it turned on" state — the same pattern as lib/site.ts (static facts)
// plus the env-derived feature flags used by lib/dashboardStatus.ts (sesEnabled,
// congressEnabled, …).
//
// The extension itself lives in the separate `matt-grant-chrome` repo; this module
// only holds what the WEB APP needs to promote it, link to it, and report whether
// the /api/ext/* surface it depends on is actually configured. It adds no new
// capability — the extension reuses the exact RBAC the dashboard already enforces
// (see lib/rbac.ts, web/docs/extension-api.md).

import type { Capability } from "@/lib/rbac";

// The four high-frequency captain actions the extension surfaces, each tied to the
// capability that gates the underlying /api/ext/* endpoint. `all` = held by every
// staff tier (admin/captain/volunteer); the events/issues writes are captain+admin.
export type ExtensionFeature = {
  key: string;
  title: string;
  blurb: string;
  cap: Capability;
};

export const EXTENSION = {
  name: "Campaign Chrome extension",
  short: "Chrome extension",
  // Faithful, non-inflated value prop — the extension is a browser-side view of the
  // same dashboard data, for field work between tabs.
  tagline: "Your campaign in the browser toolbar",
  valueProp:
    "Run your field work from any tab — add tasks, check the overview, see today's events, and clear the issue queue without leaving the page you're on. It signs in with your existing campaign account.",
  features: [
    {
      key: "tasks",
      title: "Quick-add tasks & set status",
      blurb: "Capture a to-do and move it To-do → Doing → Done from the toolbar.",
      cap: "manageTasks",
    },
    {
      key: "overview",
      title: "Overview snapshot",
      blurb: "Raised, cash on hand, donors, and active volunteers at a glance.",
      cap: "viewOverview",
    },
    {
      key: "events",
      title: "Today's events",
      blurb: "See upcoming appearances and shifts, and create or edit them.",
      cap: "manageEvents",
    },
    {
      key: "issues",
      title: "Moderate issues",
      blurb: "Approve, reject, or remove issue-board submissions on the spot.",
      cap: "moderateIssues",
    },
  ] as const satisfies readonly ExtensionFeature[],
} as const;

/**
 * The /api/ext/* surface is fail-closed until BOTH env allowlists are set:
 * EXTENSION_ORIGIN (CORS — who may read responses, lib/http/cors.ts) and
 * CLERK_AUTHORIZED_PARTIES (token trust — whose Bearer token is accepted,
 * middleware.ts). Either one blank means the extension cannot talk to the app, so
 * we treat the connection as not yet turned on.
 */
export function extensionConnected(): boolean {
  return !!process.env.EXTENSION_ORIGIN?.trim() && !!process.env.CLERK_AUTHORIZED_PARTIES?.trim();
}

/**
 * The Chrome Web Store listing URL, or null when unset — so the UI can show a
 * "coming to the Web Store" placeholder instead of a dead Install button. Public
 * (NEXT_PUBLIC_) because the Install button renders client-side.
 */
export function extensionStoreUrl(): string | null {
  return process.env.NEXT_PUBLIC_EXTENSION_STORE_URL?.trim() || null;
}
