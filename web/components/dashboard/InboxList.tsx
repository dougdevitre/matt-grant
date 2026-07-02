"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { bulkConversationAction, type BulkOp } from "@/app/dashboard/messages/actions";

export type InboxItem = {
  phone: string;
  name?: string;
  lastBody: string;
  lastDirection: "in" | "out";
  lastAt: string;
  unread: number;
  flaggedCount: number;
  blocked: boolean;
  optedOut: boolean;
};

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

// The inbox conversation list with multi-select triage. Checkboxes pick the
// targets; the bulk bar (shown only when something is selected) archives, marks
// read, or blocks them in one go via the bulkConversationAction server action.
export function InboxList({ items }: { items: InboxItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (phone: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(phone) ? next.delete(phone) : next.add(phone);
      return next;
    });
  const allSelected = items.length > 0 && selected.size === items.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.phone)));

  const run = (op: BulkOp) => {
    if (selected.size === 0) return;
    if (op === "block" && !window.confirm(`Block ${selected.size} number(s)? Their inbound texts will be ignored and you won't be able to message them.`)) return;
    const phones = [...selected];
    start(async () => {
      const res = await bulkConversationAction(phones, op);
      setMsg(res.message);
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });
  };

  if (items.length === 0) {
    return <p className="mt-3 text-sm text-slate">No conversations yet. Inbound texts and 1:1 messages you send will show up here.</p>;
  }

  return (
    <div className="mt-3">
      {/* Bulk action bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-2">
        <label className="flex items-center gap-2 text-xs text-slate">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all conversations" />
          {selected.size > 0 ? `${selected.size} selected` : "Select all"}
        </label>
        {selected.size > 0 && (
          <span className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => run("markRead")} disabled={pending} className="rounded-sm border border-line px-2.5 py-1 text-xs text-ink hover:border-ink disabled:opacity-50">
              Mark read
            </button>
            <button type="button" onClick={() => run("archive")} disabled={pending} className="rounded-sm border border-line px-2.5 py-1 text-xs text-ink hover:border-ink disabled:opacity-50">
              Archive
            </button>
            <button type="button" onClick={() => run("block")} disabled={pending} className="rounded-sm border border-line px-2.5 py-1 text-xs font-semibold text-brick hover:border-brick disabled:opacity-50">
              Block
            </button>
          </span>
        )}
        {msg && <span className="text-xs text-field">{pending ? "Working…" : msg}</span>}
      </div>

      <ul className="divide-y divide-line rounded-sm border border-line border-t-0">
        {items.map((c) => (
          <li key={c.phone} className="flex items-center gap-2 px-3 hover:bg-paper">
            <input
              type="checkbox"
              checked={selected.has(c.phone)}
              onChange={() => toggle(c.phone)}
              aria-label={`Select conversation with ${c.name ?? c.phone}`}
              className="shrink-0"
            />
            <Link
              href={`/dashboard/messages/${encodeURIComponent(c.phone)}`}
              className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <span className="min-w-0">
                <span className="font-semibold text-ink">{c.name ?? c.phone}</span>
                {c.name && <span className="ml-2 font-mono text-xs text-slate">{c.phone}</span>}
                <span className="mt-0.5 block truncate text-slate">
                  {c.lastDirection === "out" ? "↳ " : ""}
                  {c.lastBody || "—"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {c.unread > 0 && (
                  <span className="rounded-full bg-brick px-1.5 py-0.5 font-mono text-[0.6rem] font-bold text-paper">{c.unread}</span>
                )}
                {c.flaggedCount > 0 && <span title="Flagged language">⚠️</span>}
                {c.blocked && (
                  <span className="rounded-sm bg-brick/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-brick">blocked</span>
                )}
                {c.optedOut && !c.blocked && (
                  <span className="rounded-sm bg-gold/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-gold-ink">opted out</span>
                )}
                <span className="font-mono text-[0.65rem] text-slate">{when(c.lastAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
