"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { VolunteerRow } from "@/lib/queries";
import { updateVolunteer, markVolunteerContacted, setVolunteerCaptain } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { DataToolbar } from "@/components/dashboard/DataToolbar";
import { useTableQuery } from "@/components/dashboard/useTableQuery";
import { Empty } from "@/components/data/ResourceState";
import { VOLUNTEER_TABLE, type VolCtx } from "@/lib/table/volunteers-config";

const STATUSES = ["NEW", "CONTACTED", "ACTIVE", "INACTIVE"] as const;
const badge: Record<string, string> = {
  NEW: "bg-gold/15 text-gold-ink",
  CONTACTED: "bg-field/10 text-field",
  ACTIVE: "bg-field/20 text-field",
  INACTIVE: "bg-line text-slate",
};
const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();

// Deterministic (string arg) — safe under react-hooks/purity, unlike Date.now().
function contactedLabel(iso: string | null): string | null {
  if (!iso) return null;
  return `Last contacted ${new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// Advanced search/filter/sort via the shared DataToolbar + URL-bound useTableQuery.
// donorEmails/captainEmails arrive as arrays (server→client boundary) and become the
// lowercased sets used by both the card badges and the facet/ctx matching.
export function VolunteerBoard({
  rows, taskCounts, donorEmails = [], captainEmails = [], canViewDonors = false, me = null,
}: {
  rows: VolunteerRow[];
  taskCounts?: Record<string, number>;
  donorEmails?: string[];
  captainEmails?: string[];
  canViewDonors?: boolean;
  me?: string | null;
}) {
  const donorSet = useMemo(() => new Set(donorEmails.map(lc)), [donorEmails]);
  const captainSet = useMemo(() => new Set(captainEmails.map(lc)), [captainEmails]);
  const tc = useMemo(() => taskCounts ?? {}, [taskCounts]);
  const ctx = useMemo<VolCtx>(
    () => ({ me, donorSet, captainSet, taskCounts: tc, canViewDonors }),
    [me, donorSet, captainSet, tc, canViewDonors],
  );
  const { state, setState, filtered } = useTableQuery(rows, VOLUNTEER_TABLE, ctx);

  return (
    <>
      <DataToolbar cfg={VOLUNTEER_TABLE} rows={rows} state={state} setState={setState} ctx={ctx} shown={filtered.length} />

      {filtered.length === 0 ? (
        <div className="mt-4"><Empty title="No volunteers match these filters." /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => {
            const contacted = contactedLabel(v.lastContactedAt);
            const tcount = tc[v.id] ?? 0;
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
                    {donorSet.has(lc(v.email)) && (
                      <span className="rounded-sm bg-gold/15 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-gold-ink" title="Has also donated">
                        ◈ donor
                      </span>
                    )}
                    {v.door === "Team Captain" &&
                      (captainSet.has(lc(v.email)) ? (
                        <span className="rounded-sm bg-field/15 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-field" title="Team captain">
                          ★ captain
                        </span>
                      ) : (
                        <span className="rounded-sm bg-brick/10 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-brick" title="Applied to lead a team — review and promote to the captain role">
                          ★ captain applicant
                        </span>
                      ))}
                    {v.optedOut && (
                      <span className="rounded-sm bg-brick/15 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-brick" title="Opted out of contact (email unsubscribe or SMS STOP) — do not contact">
                        ⊘ opted out
                      </span>
                    )}
                    {v.pledgeFulfilled && (
                      <span className="rounded-sm bg-field/15 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-field" title="Made a donor pledge and a matching WinRed gift has landed — pledge fulfilled">
                        ✓ pledge fulfilled
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
                {v.captainEmail && lc(v.captainEmail) !== lc(me) ? (
                  <p className="mt-2 font-mono text-[0.65rem] text-slate" title={v.captainEmail}>
                    Captain: <span className="text-ink">{v.captainEmail}</span>
                  </p>
                ) : (
                  <form action={setVolunteerCaptain} className="mt-2">
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="action" value={lc(v.captainEmail) === lc(me) ? "release" : "claim"} />
                    <SubmitButton pendingText="Saving…" className="text-xs font-semibold text-field hover:underline disabled:opacity-50">
                      {lc(v.captainEmail) === lc(me) ? "↩ Release from my team" : "＋ Claim to my team"}
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
