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
