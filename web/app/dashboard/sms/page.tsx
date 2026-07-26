import { redirect } from "next/navigation";
import Link from "next/link";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { SmsComposer } from "@/components/dashboard/SmsComposer";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { smsEnabled } from "@/lib/sms/send";
import {
  smsAudienceCounts,
  smsVolRoleCounts,
  smsCaptainTeamCount,
  smsTargetCounts,
  SMS_GROUP_LABELS,
  VOL_ROLE_OPTIONS,
  TARGET_COUNTY_OPTIONS,
  TARGET_DISTRICT_OPTIONS,
  TARGET_PARTY_OPTIONS,
  TARGET_PP_OPTIONS,
  OUTSTANDING_TOKEN,
  VOTER_SEGMENT_NAMES,
  SMS_PRIORITY_PRESETS,
  presetTokens,
} from "@/lib/sms/audiences";
import { UNSCORED_KEY } from "@/lib/reports/smsSpend";
import { smsInsightsReadiness } from "@/lib/reports/smsInsights";
import { optinGrowth } from "@/lib/reports/optinGrowth";
import { OptinGrowth } from "@/components/dashboard/OptinGrowth";
import { listConsent } from "@/lib/sms/consent";
import { listSmsCampaigns } from "@/lib/sms/campaigns";
import { estimateDrainCompletion, formatEtaCT } from "@/lib/sms/pacing";
import { relTime, isStale } from "@/lib/relativeTime";
import { listSavedTemplates } from "@/lib/notifications/messageTemplates";

export const dynamic = "force-dynamic";

export default async function SmsPage() {
  const { role, email } = await staffGate();
  if (!can(role, "draftSms")) redirect("/dashboard?denied=sms");
  // Admins send to the full list; captains send to their OWN opted-in team (sendTeamSms).
  const isAdmin = can(role, "sendSms");
  const isCaptain = !isAdmin && can(role, "sendTeamSms");
  const canSend = isAdmin || isCaptain;
  const scope = isCaptain ? "captain" : "admin";
  const captainEmail = isCaptain ? email ?? undefined : undefined;

  const [counts, volRoleCounts, teamCount, targetCounts, insights, consent, sent, enabled, saved] = await Promise.all([
    smsAudienceCounts(),
    // Captain: chip counts scoped to their team so the reach shown matches what actually sends.
    smsVolRoleCounts(captainEmail),
    isCaptain ? smsCaptainTeamCount(captainEmail) : Promise.resolve(0),
    // Targeting chips are admin-only (their counts cover the whole opt-in ledger).
    isAdmin ? smsTargetCounts() : Promise.resolve({} as Record<string, number>),
    // Insight freshness for the composer's priority dropdown (admin only): how much of
    // the opted-in list is scored + when enrichment last ran.
    isAdmin ? smsInsightsReadiness() : Promise.resolve(null),
    // Consent ledger for the opt-in growth panel (admin only — list strategy).
    isAdmin ? listConsent() : Promise.resolve([]),
    listSmsCampaigns(15),
    smsEnabled(),
    listSavedTemplates("sms"),
  ]);
  const groups = [
    { value: "subscribers", label: SMS_GROUP_LABELS.subscribers, count: counts.subscribers },
    { value: "volunteers", label: SMS_GROUP_LABELS.volunteers, count: counts.volunteers },
  ];
  // Only surface volunteer-role chips that actually have opted-in members, so the
  // section isn't a wall of zeros (all 23 taxonomy tokens).
  const volRoles = VOL_ROLE_OPTIONS.map((o) => ({ ...o, count: volRoleCounts[o.value] ?? 0 })).filter((o) => o.count > 0);
  // Targeting chips (admin only): counties/districts with at least one tagged
  // opted-in number, plus the GOTV "not yet voted" chip once any tags exist —
  // hidden entirely until the vote agent or enrichment job has produced data.
  // Voter SEGMENTS are no longer chips here — they're owned by the priority-tier
  // preset dropdown below (built from SMS_PRIORITY_PRESETS); the chips stay as
  // optional geographic fine-tuning that narrows the chosen priority group.
  // Party and primary-propensity chips come from a vendor OVERLAY source
  // (candidate/voter-registry-refresh-plan.md); like the county/district chips
  // they stay hidden until enrichment has actually tagged someone, so the
  // composer never offers a filter that would resolve to nobody.
  const targets = isAdmin
    ? [
        ...TARGET_COUNTY_OPTIONS.map((o) => ({ ...o, count: targetCounts[o.value] ?? 0 })).filter((o) => o.count > 0),
        ...TARGET_DISTRICT_OPTIONS.map((o) => ({ ...o, count: targetCounts[o.value] ?? 0 })).filter((o) => o.count > 0),
        ...TARGET_PP_OPTIONS.map((o) => ({ ...o, count: targetCounts[o.value] ?? 0 })).filter((o) => o.count > 0),
        ...TARGET_PARTY_OPTIONS.map((o) => ({ ...o, count: targetCounts[o.value] ?? 0 })).filter((o) => o.count > 0),
      ]
    : [];
  if (targets.length > 0) targets.push({ value: OUTSTANDING_TOKEN, label: "Not yet voted", count: targetCounts[OUTSTANDING_TOKEN] ?? 0 });
  // Per-segment opted-in counts feed the composer's priority-tier presets and the
  // inline budget/coverage math (same derivation as the Spend Decider page). Admin
  // only — segment tags cover the whole opt-in ledger. UNSCORED = opted-in minus the
  // sum of scored segments, so the budget coverage readout accounts for the tail.
  const segmentCounts: Record<string, number> = {};
  let scored = 0;
  for (const s of VOTER_SEGMENT_NAMES) {
    const n = isAdmin ? targetCounts[`segment:${s}`] ?? 0 : 0;
    segmentCounts[s] = n;
    scored += n;
  }
  segmentCounts[UNSCORED_KEY] = Math.max(0, counts.subscribers - scored);
  // Priority-tier presets for the composer's "Who to reach — by likelihood to vote"
  // dropdown (admin only). Each carries its expanded target tokens and an opted-in
  // reach (segment-count sum, or the whole opted-in list for "all") so the client
  // needs no audiences.ts import. Always passed for admins — the composer renders a
  // disabled/zero state when no voter tags exist yet, for discoverability.
  const priorityPresets = isAdmin
    ? SMS_PRIORITY_PRESETS.map((p) => ({
        value: p.value,
        label: p.label,
        tokens: presetTokens(p),
        // A propensity-gated preset's reach is the pp chip's count, NOT the whole
        // opted-in list — an empty `segments` alone would otherwise read as "all".
        count:
          p.minPp !== undefined
            ? targetCounts[`pp:${p.minPp}`] ?? 0
            : p.segments.length === 0
              ? counts.subscribers
              : p.segments.reduce((n, s) => n + (segmentCounts[s] ?? 0), 0),
      }))
    : [];
  // Insight freshness shown beside the priority dropdown: what share of the opted-in
  // list is scored + a server-formatted "last enriched" label (formatting on the
  // server keeps the client component hydration-safe). Admin only.
  const insight = insights
    ? { scoredPct: insights.scoredPct, lastEnrichedLabel: relTime(insights.lastEnrichedAt), stale: isStale(insights.lastEnrichedAt) }
    : undefined;
  // Opt-in growth (admin only): where the textable list comes from + a recent trend.
  const growth = isAdmin ? optinGrowth(consent) : null;
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <>
      <PageHeader kicker="Comms" title="Text blasts" />
      <HowTo
        steps={[
          "Pick a template, fill any fields, and watch the live preview + segment counter (multi-segment texts cost more).",
          "Texts only go to numbers that have opted in (texted the keyword or checked the web consent box). The audience counts show how many that is.",
          "Every text includes the sender's name and “Reply STOP to opt out.” STOP is honored automatically, and the send respects quiet hours (9am–8pm CT).",
          "Always send a test to your own opted-in number first.",
          "Admins send to the full opted-in list; captains send to their own opted-in team.",
        ]}
      />

      {!enabled && (
        <div className="mb-6 rounded-sm border border-gold/50 bg-gold/10 px-5 py-4 text-sm text-ink">
          <p className="font-semibold">Texting isn&apos;t configured yet.</p>
          <p className="mt-1 text-slate">
            Add the Twilio credentials (account SID, auth token, messaging service) in SSM. You can still draft here.
            Carrier delivery also needs Toll-Free Verification approved.
          </p>
          {isAdmin && (
            <Link href="/dashboard/sms/go-live" className="mt-2 inline-block font-mono text-xs font-bold text-brick hover:underline">
              Finish setup →
            </Link>
          )}
        </div>
      )}

      <SmsComposer groups={groups} volRoles={volRoles} targets={targets} priorityPresets={priorityPresets} saved={saved} canSend={canSend} disabled={!enabled} scope={scope} teamCount={teamCount} optedIn={counts.subscribers} segmentCounts={segmentCounts} insight={insight} />

      <div className="mt-8">
        <p className="eyebrow text-slate">Recent sends</p>
        {sent.length > 0 ? (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {sent.map((c) => {
              // ETA for a blast still draining (queued/sending, some left): window-aware,
              // so operators see when a large send finishes. Scheduled rows show their
              // start time instead, so no ETA there.
              const remaining = Math.max(0, c.total - c.sentCount);
              const draining = (c.status === "queued" || c.status === "sending") && remaining > 0;
              const etaNote = draining ? ` · ~done ${formatEtaCT(estimateDrainCompletion(remaining).eta)}` : "";
              return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">{c.body.length > 60 ? `${c.body.slice(0, 60)}…` : c.body}</span>{" "}
                  <span className="text-slate">
                    → {c.audience} · {c.sentCount}/{c.total} sent
                    {c.failedCount ? ` · ${c.failedCount} failed` : ""}
                    {c.skippedCount ? ` · ${c.skippedCount} skipped` : ""}{etaNote} · by {c.createdBy}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow ${
                      c.status === "sent"
                        ? "bg-field/10 text-field"
                        : c.status === "failed"
                          ? "bg-brick/10 text-brick"
                          : "bg-gold/15 text-gold-ink"
                    }`}
                  >
                    {c.status === "scheduled" ? "scheduled" : c.status === "queued" || c.status === "sending" ? "sending" : c.status}
                  </span>
                  <span className="font-mono text-[0.65rem] text-slate">
                    {c.status === "scheduled" && c.scheduledAt ? `→ ${when(c.scheduledAt)}` : when(c.createdAt)}
                  </span>
                </span>
              </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate">No text blasts sent yet.</p>
        )}
      </div>

      {growth && <OptinGrowth growth={growth} />}
    </>
  );
}
