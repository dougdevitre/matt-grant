// Search/filter/sort config for the dashboard Subscribers (suppression) list.
// Declarative over SubscriberRow; pairs with SUBSCRIBER_COLUMNS in the client table.
import { TOPICS, type SubscriberRow } from "@/lib/subscribers-shared";
import type { TableConfig } from "./types";

const topicLabel: Record<string, string> = Object.fromEntries(TOPICS.map((t) => [t.key, t.label]));
const isPartial = (r: SubscriberRow) => r.status === "subscribed" && r.optOut.length > 0;

export const SUBSCRIBER_TABLE: TableConfig<SubscriberRow> = {
  id: "subscribers",
  search: (r) => [r.email, r.status, ...r.optOut.map((t) => topicLabel[t] ?? t)].join(" "),
  facets: [
    {
      key: "status",
      label: "Status",
      type: "multi",
      options: (rows) => [...new Set(rows.map((r) => r.status))].sort().map((v) => ({ value: v, label: v })),
      match: (r, sel) => (sel as string[]).includes(r.status),
    },
    {
      key: "partial",
      label: "Partial opt-out (still subscribed)",
      type: "boolean",
      match: (r) => isPartial(r),
    },
  ],
  sorts: [
    { key: "updated", label: "Last updated", compare: (a, b) => (a.updatedAt ?? "").localeCompare(b.updatedAt ?? "") },
    { key: "email", label: "Email", compare: (a, b) => a.email.localeCompare(b.email) },
    { key: "status", label: "Status", compare: (a, b) => a.status.localeCompare(b.status) },
  ],
  defaultSort: { key: "updated", dir: "desc" },
  presets: [
    { name: "Bounced / complained", state: { facets: { status: ["bounced", "complained"] } } },
    { name: "Partial opt-outs", state: { facets: { partial: true } } },
  ],
};
