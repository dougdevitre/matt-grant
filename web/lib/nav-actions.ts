import { CAMPAIGN } from "./site";
import type { CampaignPhase } from "./campaign-phase";

// The single most important call-to-action, resolved from the campaign phase and
// (when known) the visitor's role. One button, different best-next-action:
//   GOTV stretch   → everyone is pushed to turnout ("Plan your vote")
//   returning donor → a warmer, lower-friction ask ("Give again")
//   everyone else  → "Donate"
// Pure so it can drive both the signed-out default and the role-aware variant.

export type PrimaryAction = {
  label: string;
  href: string;
  external: boolean;
  context?: string; // CtaButton thumbnail context (see lib/cta-images.ts)
};

export function primaryAction(phase: CampaignPhase, role: string | null): PrimaryAction {
  if (phase === "gotv") {
    return { label: "Plan your vote", href: "/vote", external: false };
  }
  if (role === "donor") {
    return { label: "Give again", href: CAMPAIGN.donateUrl, external: true, context: "donate" };
  }
  return { label: "Donate", href: CAMPAIGN.donateUrl, external: true, context: "donate" };
}

// A secondary ask shown alongside the primary. During GOTV the primary becomes
// turnout, so Donate is kept as a quieter secondary — fundraising never drops
// out of the header in the most expensive stretch. Null when not needed (the
// primary already is the donate ask).
export function secondaryAction(phase: CampaignPhase, role: string | null): PrimaryAction | null {
  if (phase !== "gotv") return null;
  return {
    label: role === "donor" ? "Give again" : "Donate",
    href: CAMPAIGN.donateUrl,
    external: true,
    context: "donate",
  };
}
