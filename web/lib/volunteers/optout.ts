import "server-only";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { mirrorVolunteerOptOutToAirtable } from "@/lib/volunteers/airtable";

// Reflect a contact opt-out (email unsubscribe-all / SMS STOP) — or a re-subscribe
// — onto the matching volunteer record, so staff working the roster don't reach out
// to someone who asked not to be contacted. Best-effort: if there's no matching
// volunteer (most opt-outs are pure subscribers), it's a silent no-op, and nothing
// here ever throws into the opt-out flow that called it.

// Volunteer records are keyed by `e:<email>` or `p:<digits>`. SMS arrives as E.164
// (+1…), while web signups store whatever the user typed — so for a phone we try the
// raw digits AND the 10-digit (no country code) form to bridge the two.
function candidateKeys(who: { email?: string | null; phone?: string | null }): string[] {
  const email = who.email?.trim().toLowerCase();
  if (email) return [`e:${email}`];
  const digits = (who.phone ?? "").replace(/\D/g, "");
  if (!digits) return [];
  const tenDigit = digits.replace(/^1/, "");
  return [...new Set([`p:${digits}`, `p:${tenDigit}`])];
}

/**
 * Set (or clear) the opt-out flag on the volunteer keyed by email or phone, and
 * mirror it to the Airtable roster. Updates only an EXISTING record (conditional),
 * trying each candidate key until one matches. Never throws.
 */
export async function setVolunteerContactOptOut(
  who: { email?: string | null; phone?: string | null },
  optedOut: boolean,
): Promise<void> {
  if (!dbConfigured) return;
  const now = new Date().toISOString();
  for (const sk of candidateKeys(who)) {
    try {
      const res = await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: PK.volunteers, SK: sk },
          ConditionExpression: "attribute_exists(PK)", // only touch a record that exists
          ReturnValues: "ALL_NEW",
          UpdateExpression: "SET optedOut = :o, optedOutAt = :u",
          ExpressionAttributeValues: { ":o": optedOut, ":u": now },
        }),
      );
      await mirrorVolunteerOptOutToAirtable((res.Attributes?.airtableId as string) ?? null, optedOut).catch(() => {});
      return; // matched a record — done
    } catch (err) {
      // No volunteer with this key → try the next candidate. Any other error: stop.
      if ((err as { name?: string })?.name !== "ConditionalCheckFailedException") {
        console.warn("[volunteers] opt-out flag failed:", err instanceof Error ? err.message : err);
        return;
      }
    }
  }
}
