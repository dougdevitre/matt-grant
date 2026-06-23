// Single source of truth for the dashboard "Setup & status" page: gathers each
// integration's live/needs-setup state from the same helpers the app already uses,
// so admins get one place to see what's wired up. Every source is wrapped so one
// failing lookup (or an unconfigured DB) never breaks the page.
import { sesEnabled } from "@/lib/email/send";
import { smsEnabled } from "@/lib/sms/send";
import { optedInSet } from "@/lib/sms/consent";
import { listConnections } from "@/lib/social/connections";
import { getSecret } from "@/lib/ssm";
import { dbConfigured, TABLE } from "@/lib/db";
import { congressEnabled } from "@/lib/integrations/legislative/config";
import { lastFieldIngest } from "@/lib/integrations/research/ingestField";

export type StatusState = "live" | "setup" | "off";
export type StatusRow = {
  key: string;
  label: string;
  state: StatusState;
  detail: string;
  actionHref?: string;
  actionText?: string;
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function getDashboardStatus(): Promise<StatusRow[]> {
  const [sms, optedIn, connections, winredSecret, ingest] = await Promise.all([
    safe(() => smsEnabled(), false),
    safe(() => optedInSet(), new Set<string>()),
    safe(() => listConnections(), [] as Awaited<ReturnType<typeof listConnections>>),
    safe(() => getSecret("WINRED_WEBHOOK_SECRET"), undefined),
    safe(() => lastFieldIngest(), null),
  ]);

  const connected = connections.map((c) => c.platform);
  const now = Date.now();
  const expiring = connections.filter(
    (c) => c.expiresAt && new Date(c.expiresAt).getTime() - now < 7 * 86_400_000,
  ).length;
  const ingestAt = ingest?.startedAt ? new Date(ingest.startedAt).toLocaleDateString() : null;

  return [
    {
      key: "database",
      label: "Database",
      state: dbConfigured ? "live" : "off",
      detail: dbConfigured
        ? `Connected — table "${TABLE}".`
        : "Not connected — the dashboard is showing demo data. Set DYNAMODB_TABLE.",
    },
    {
      key: "email",
      label: "Email",
      state: sesEnabled ? "live" : "setup",
      detail: sesEnabled
        ? "Sender verified — receipts and broadcasts can send."
        : "Not set up. Verify a sender in SES and set SES_FROM to send email.",
      actionHref: "/dashboard/emails",
      actionText: "Email",
    },
    {
      key: "sms",
      label: "Text messages (SMS)",
      state: sms ? "live" : "setup",
      detail: sms
        ? `Live — ${optedIn.size} ${optedIn.size === 1 ? "person" : "people"} opted in.`
        : "Not set up. Add Twilio credentials (account SID, auth token, messaging service) to send texts.",
    },
    {
      key: "social",
      label: "Social media",
      state: connected.length ? "live" : "setup",
      detail: connected.length
        ? `Connected: ${connected.join(", ")}.${expiring ? ` ${expiring} expiring soon — reconnect.` : ""}`
        : "No platforms connected. Connect accounts to publish automatically.",
      actionHref: "/dashboard/social",
      actionText: "Social",
    },
    {
      key: "winred",
      label: "Donations (WinRed)",
      state: winredSecret ? "live" : "setup",
      detail: winredSecret
        ? "Webhook secret set — online donations post in automatically."
        : "Not set up. Add WINRED_WEBHOOK_SECRET to accept donation webhooks.",
      actionHref: "/dashboard/donors",
      actionText: "Donors",
    },
    {
      key: "research",
      label: "Opposition research",
      state: congressEnabled ? "live" : "setup",
      detail: congressEnabled
        ? ingestAt
          ? `Connected — data as of ${ingestAt}.`
          : "Connected — no data ingested yet."
        : "Not set up. Add a Congress.gov API key to pull the opponent's record.",
      actionHref: "/dashboard/research",
      actionText: "Research",
    },
  ];
}
