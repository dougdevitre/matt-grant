import { redirect } from "next/navigation";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { SmsSpendDecider } from "@/components/dashboard/SmsSpendDecider";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { smsAudienceCounts, smsTargetCounts, VOTER_SEGMENT_NAMES } from "@/lib/sms/audiences";
import { UNSCORED_KEY } from "@/lib/reports/smsSpend";

export const dynamic = "force-dynamic";

// Admin-only (sendSms = full-list broadcast rights): budget/cap decisions belong
// to whoever can actually send to the full list. The sidebar hides the link for
// everyone else, but this page-level gate is the security boundary.
export default async function SmsSpendPage() {
  const { role } = await staffGate();
  if (!can(role, "sendSms")) redirect("/dashboard?denied=sms-spend");

  // Live numbers, fetched server-side (audiences.ts reads DynamoDB and must not
  // enter the client bundle): the opted-in count prefills list size, and the
  // enrichment tags feed the priority-coverage table with real segment counts.
  const [counts, targetCounts] = await Promise.all([smsAudienceCounts(), smsTargetCounts()]);
  const optedIn = counts.subscribers;
  const segmentCounts: Record<string, number> = {};
  let scored = 0;
  for (const s of VOTER_SEGMENT_NAMES) {
    const n = targetCounts[`segment:${s}`] ?? 0;
    segmentCounts[s] = n;
    scored += n;
  }
  segmentCounts[UNSCORED_KEY] = Math.max(0, optedIn - scored);

  return (
    <>
      <PageHeader kicker="Comms" title="SMS spend decider" />
      <HowTo
        steps={[
          "Paste the message you plan to blast — the segment counter uses the same math as the composer, disclaimer included.",
          "Check the Twilio pricing defaults against twilio.com/en-us/sms/pricing/us before committing a budget.",
          "Enter list size, planned sends, and a total budget to get the Max texts cap to type into the composer.",
          "The coverage table shows exactly which voter-priority groups a capped blast reaches — the cap always cuts from the bottom.",
          "All figures are planning estimates; reconcile real spend against the Twilio console and record it as an FEC disbursement.",
        ]}
      />
      <SmsSpendDecider optedIn={optedIn} segmentCounts={segmentCounts} />
    </>
  );
}
