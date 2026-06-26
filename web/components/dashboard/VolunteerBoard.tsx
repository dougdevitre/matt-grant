"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { VolunteerRow } from "@/lib/queries";
import { isIn } from "@/lib/engagement";
import { updateVolunteer, markVolunteerContacted, setVolunteerCaptain } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/dashboard/SubmitButton";

const STATUSES = ["NEW", "CONTACTED", "ACTIVE", "INACTIVE"] as const;
// The fixed set offered on the public contact form — used for the interest filter.
const INTERESTS = ["Knock doors", "Make calls", "Host an event", "Yard sign", "Donate", "Other"] as const;

const badge: Record<string, string> = {
  NEW: "bg-gold/15 text-[#9a6f1a]",
  CONTACTED: "bg-field/10 text-field",
  ACTIVE: "bg-field/20 text-field",
  INACTIVE: "bg-line text-slate",
};
const select = "rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink";

// Deterministic (string arg) — safe under react-hooks/purity, unlike Date.now().
function contactedLabel(iso: string | null): string | null {
  if (!iso) return null;
  return `Last contacted ${new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// donorEmails: addresses present in the donor list, to flag volunteers who have
// also given. Array (not Set) so it can cross the server→client boundary.
export function VolunteerBoard({ rows, taskCounts, donorEmails = [], me = null }: { rows: VolunteerRow[]; taskCounts?: Record<string, number>; donorEmails?: string[]; me?: string | null }) {
  const [status, setStatus] = useState("ALL");
  const [interest, setInterest] = useState("ALL");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const donorSet = useMemo(() => new Set(donorEmails), [donorEmails]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((v) => {
      if (mine && me && v.captainEmail !== me) return false;
      if (status !== "ALL" && v.status !== status) return false;
      if (interest !== "ALL") {
        const tags = v.interestTags?.length ? v.interestTags : v.interests ? v.interests.split(",").map((s) => s.trim()) : [];
        if (!tags.some((t) => t.toLowerCase() === interest.toLowerCase())) return false;
      }
      if (needle) {
        const hay = [v.name, v.city, v.email, v.phone, v.interests, v.notes, v.assignedTo, v.captainEmail].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, status, interest, q, mine, me]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of rows) c[v.status] = (c[v.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const mineCount = useMemo(() => (me ? rows.filter((v) => v.captainEmail === me).length : 0), [rows, me]);

  return (
    <>
      {/* Filter bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, city, email, owner, notes…"
          aria-label="Search volunteers"
          className={`${select} min-w-[14rem] flex-1`}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className={select}>
          <option value="ALL">All statuses ({rows.length})</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s} ({counts[s] ?? 0})</option>
          ))}
        </select>
        <select value={interest} onChange={(e) => setInterest(e.target.value)} aria-label="Filter by interest" className={select}>
          <option value="ALL">All interests</option>
          {INTERESTS.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
        {me && (
          <label className="flex items-center gap-1.5 font-mono text-xs text-slate" title="Show only volunteers you've claimed to your team">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            My volunteers ({mineCount})
          </label>
        )}
        <span className="font-mono text-xs text-slate">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-slate">No volunteers match these filters.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => {
            const contacted = contactedLabel(v.lastContactedAt);
            const tcount = taskCounts?.[v.id] ?? 0;
            return (
              <div key={v.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/dashboard/volunteers/${encodeURIComponent(v.id)}`}
                      className="font-display text-lg font-semibold text-ink hover:text-brick"
                    >
                      {v.name}
                    </Link>
                    {v.city && <p className="text-sm text-slate">{v.city}</p>}
                    {tcount > 0 && (
                      <p className="mt-0.5 font-mono text-[0.65rem] text-field">{tcount} task{tcount === 1 ? "" : "s"} assigned</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-sm px-2 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow ${badge[v.status] ?? "bg-line text-slate"}`}>
                      {v.status}
                    </span>
                    {isIn(donorSet, v.email) && (
                      <span className="rounded-sm bg-gold/15 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-[#9a6f1a]" title="Has also donated">
                        ◈ donor
                      </span>
                    )}
                  </div>
                </div>
                {v.interests && <p className="mt-3 text-sm text-slate">{v.interests}</p>}
                {v.notes && (
                  <p className="mt-2 rounded-sm border-l-2 border-line bg-paper px-3 py-2 text-sm italic text-slate">
                    &ldquo;{v.notes}&rdquo;
                  </p>
                )}
                {v.email && <p className="mt-2 font-mono text-xs text-field">{v.email}</p>}
                {v.phone && <p className="font-mono text-xs text-field">{v.phone}</p>}

                {(v.assignedTo || contacted) && (
                  <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-slate">
                    {v.assignedTo && <span>Owner: <span className="text-ink">{v.assignedTo}</span></span>}
                    {contacted && <span>{contacted}</span>}
                  </p>
                )}

                {/* Status + owner */}
                <form action={updateVolunteer} className="mt-4 space-y-2">
                  <input type="hidden" name="id" value={v.id} />
                  <div className="flex items-center gap-2">
                    <select name="status" aria-label="Set volunteer status" defaultValue={v.status} className="flex-1 rounded-sm border border-line bg-white px-2 py-1.5 text-xs text-ink">
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <SubmitButton pendingText="Saving…" className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-50">Save</SubmitButton>
                  </div>
                  <input
                    name="assignedTo"
                    defaultValue={v.assignedTo ?? ""}
                    placeholder="Assign owner (name/initials)"
                    aria-label="Assign owner"
                    className="w-full rounded-sm border border-line bg-white px-2 py-1.5 text-xs text-ink"
                  />
                </form>

                {/* Quick log-contact */}
                <form action={markVolunteerContacted} className="mt-2">
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="current" value={v.status} />
                  <SubmitButton pendingText="Saving…" className="text-xs font-semibold text-field hover:underline disabled:opacity-50">
                    ✓ Mark contacted today
                  </SubmitButton>
                </form>

                {/* Team ownership — captain claim / release */}
                {v.captainEmail && v.captainEmail !== me ? (
                  <p className="mt-2 font-mono text-[0.65rem] text-slate" title={v.captainEmail}>
                    Captain: <span className="text-ink">{v.captainEmail}</span>
                  </p>
                ) : (
                  <form action={setVolunteerCaptain} className="mt-2">
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="action" value={v.captainEmail === me ? "release" : "claim"} />
                    <SubmitButton pendingText="Saving…" className="text-xs font-semibold text-field hover:underline disabled:opacity-50">
                      {v.captainEmail === me ? "↩ Release from my team" : "＋ Claim to my team"}
                    </SubmitButton>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
