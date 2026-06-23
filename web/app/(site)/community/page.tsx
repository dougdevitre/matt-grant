import Link from "next/link";
import type { Metadata } from "next";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { CaseForChange } from "@/components/CaseForChange";
import { CommunityOnboarding } from "@/components/CommunityOnboarding";
import { supporterTierForEmail } from "@/lib/supporterTier";
import { getProfile } from "@/lib/profile";
import { dollars } from "@/lib/money";
import { CAMPAIGN, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The Community — Matt Grant for Congress",
  robots: { index: false, follow: false },
};

// The supporter hub — the landing for anyone who joins the community at signup.
// Sign-in is required (enforced in middleware). It shows ONLY public-safe content:
// the shared case-for-change board + ways to help. No donors, finance, or
// internal data — a supporter has none of those capabilities.
export default async function CommunityPage() {
  const gate = await staffGate();
  const isStaff = can(gate.role, "viewOverview"); // admin / captain / member

  // Engagement tier is derived from the signed-in user's OWN records — their
  // giving and their own volunteer signup, never anyone else's data (see
  // supporterTier.ts). Giving or signing up to help unlocks recognition
  // automatically; RBAC roles are unaffected.
  const me = await supporterTierForEmail(gate.email);
  const donor = me.donor;

  // Show the (non-blocking) onboarding card until the supporter has filled it in.
  const profile = await getProfile(gate.email);
  const onboarded = !!profile?.onboardedAt;

  let firstName = "";
  try {
    const { currentUser } = await import("@clerk/nextjs/server");
    const u = await currentUser();
    firstName = (u?.firstName ?? "").trim();

    // Guarantee the welcome email. Any signed-in community member (a supporter,
    // or a brand-new self-signup whose role hasn't stamped yet — i.e. not staff
    // or partner) who hasn't been welcomed gets it now. Idempotent via the
    // welcomedAt flag, so it can't double-send with the webhook. This is the
    // reliable path: it doesn't depend on the webhook firing or its send working.
    const welcomedAt = (u?.privateMetadata as { welcomedAt?: unknown } | undefined)?.welcomedAt;
    const isCommunityMember = !isStaff && gate.role !== "partner";
    if (u && gate.email && !welcomedAt && isCommunityMember) {
      const { ensureWelcomed } = await import("@/lib/welcome");
      await ensureWelcomed({ userId: u.id, email: gate.email, firstName: u.firstName });
    }
  } catch {
    /* clerk off (demo) — no name, no welcome */
  }

  const shareText = encodeURIComponent(
    "I just joined the Matt Grant for Congress community — it's time for a change in Missouri's 2nd District. Join me:",
  );
  const shareUrl = encodeURIComponent(SITE_URL);

  return (
    <section className="container-page py-16 sm:py-20">
      <p className="eyebrow text-brick">{me.isDonor ? "Donor · thank you" : me.isVolunteer ? "Volunteer · thank you" : "You’re in"}</p>
      <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
        Welcome to the community{firstName ? `, ${firstName}` : ""}.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate">
        You&apos;re now part of the movement to restore public trust in MO-02. Here&apos;s the case we&apos;re
        making together — and three ways you can help right now.
      </p>

      {donor.hasDonated && (
        <div className="mt-6 max-w-2xl rounded-sm border border-gold/40 bg-gold/10 p-5">
          <p className="font-display text-lg font-semibold text-ink">
            Thank you for chipping in{firstName ? `, ${firstName}` : ""}.
          </p>
          <p className="mt-1 text-sm text-slate">
            Your support{donor.totalCents > 0 ? ` of ${dollars(donor.totalCents)}` : ""}
            {donor.gifts > 1 ? ` across ${donor.gifts} gifts` : ""} is funding doors, calls, and mail
            across MO-02. You&apos;re part of the core making this race winnable.
          </p>
        </div>
      )}

      {me.isVolunteer && !me.isDonor && (
        <div className="mt-6 max-w-2xl rounded-sm border border-field/40 bg-field/10 p-5">
          <p className="font-display text-lg font-semibold text-ink">
            Thank you for stepping up{firstName ? `, ${firstName}` : ""}.
          </p>
          <p className="mt-1 text-sm text-slate">
            You&apos;re signed up to help — this race is won one neighbor at a time, and you&apos;re part of
            how we get there. Pick your next action below.
          </p>
        </div>
      )}

      {isStaff && (
        <Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold text-brick hover:underline">
          You&apos;re on the team — go to Campaign HQ →
        </Link>
      )}

      {/* Additive onboarding — only until they've personalized; never blocks the hub */}
      {!onboarded && <CommunityOnboarding />}

      {/* The shared, public-safe case-for-change board */}
      <CaseForChange />

      {/* Ways to help — the conversion section */}
      <h2 className="mt-14 text-2xl font-semibold">Three ways to help</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <a
          href={CAMPAIGN.donateUrl}
          className="card flex flex-col p-6 transition-colors hover:border-brick"
        >
          <span className="font-mono text-2xl text-brick" aria-hidden>◈</span>
          <p className="mt-3 font-display text-lg font-semibold">{donor.hasDonated ? "Give again" : "Chip in"}</p>
          <p className="mt-1 text-sm text-slate">Every dollar funds doors, calls, and mail before {CAMPAIGN.electionLabel}.</p>
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="card flex flex-col p-6 transition-colors hover:border-brick"
        >
          <span className="font-mono text-2xl text-brick" aria-hidden>➦</span>
          <p className="mt-3 font-display text-lg font-semibold">Share it</p>
          <p className="mt-1 text-sm text-slate">Post the case for change and bring a neighbor into the community.</p>
        </a>
        <Link href="/act" className="card flex flex-col p-6 transition-colors hover:border-brick">
          <span className="font-mono text-2xl text-brick" aria-hidden>✶</span>
          <p className="mt-3 font-display text-lg font-semibold">Take action</p>
          <p className="mt-1 text-sm text-slate">Volunteer, host, or pick the way you want to get involved.</p>
        </Link>
      </div>

      <p className="mt-10 text-xs text-slate">
        Paid for by the Matt Grant for Congress Committee. You&apos;re seeing the supporter community —
        campaign operations stay private to the team.
      </p>
    </section>
  );
}
