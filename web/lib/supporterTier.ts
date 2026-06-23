import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { donorSummaryForEmail, type DonorSummary } from "@/lib/donorStatus";

// Derived engagement tier for a supporter — NOT an RBAC role.
//
// SECURITY: like donorStatus, this is SELF-SCOPED. Pass the AUTHENTICATED user's
// own email (gate.email). It reads only that person's own records — their donor
// row and their own volunteer signup — and never lists or exposes anyone else's
// data, which is what makes it safe to surface to a `supporter` (who has no donor
// or volunteer access). Do NOT add a path that takes an arbitrary/other email.
//
// The tiers stack by engagement, highest wins:
//   donor      — a net-positive contribution on file (see donorStatus.ts)
//   volunteer  — a volunteer/lead record on file (contact or issue intake)
//   supporter  — signed up; public community hub only (the default)
// Giving or signing up to help unlocks the tier automatically — no admin step,
// exactly like the existing donor view. RBAC roles are untouched by this.

export type Tier = "donor" | "volunteer" | "supporter";

export type SupporterTier = {
  tier: Tier;
  isDonor: boolean;
  isVolunteer: boolean;
  donor: DonorSummary; // giving summary (zeroed when not a donor)
};

const NO_DONOR: DonorSummary = { hasDonated: false, totalCents: 0, gifts: 0 };
const BASE: SupporterTier = { tier: "supporter", isDonor: false, isVolunteer: false, donor: NO_DONOR };

// True if the signed-in user has their OWN volunteer record. Volunteer rows are
// keyed inconsistently across intakes: the contact form dedupes on `e:<email>`
// (fast Get), while issue-page commits use a random id with an `email` attribute
// (needs a single-partition match). Try the cheap keyed read first, then fall back.
async function hasVolunteerRecord(email: string): Promise<boolean> {
  const e = email.toLowerCase();
  try {
    const direct = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.volunteers, SK: `e:${e}` } }));
    if (direct.Item) return true;
  } catch {
    /* fall through to the partition scan */
  }
  try {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": PK.volunteers },
        ProjectionExpression: "email",
      }),
    );
    return (r.Items ?? []).some((i) => String(i.email ?? "").toLowerCase() === e);
  } catch {
    return false;
  }
}

export async function supporterTierForEmail(email?: string | null): Promise<SupporterTier> {
  if (!dbConfigured || !email) return BASE;
  const [donor, isVolunteer] = await Promise.all([donorSummaryForEmail(email), hasVolunteerRecord(email)]);
  const isDonor = donor.hasDonated;
  const tier: Tier = isDonor ? "donor" : isVolunteer ? "volunteer" : "supporter";
  return { tier, isDonor, isVolunteer, donor };
}
