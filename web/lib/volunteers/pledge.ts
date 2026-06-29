import "server-only";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { mirrorVolunteerPledgeFulfilledToAirtable } from "@/lib/volunteers/airtable";

// Pledge ↔ gift reconciliation. When a real WinRed donation lands (donation webhook),
// mark the matching "Donor Pledge" volunteer record as fulfilled — so staff stop
// chasing someone who already gave — and reflect it on the Airtable roster.
//
// Conditional + best-effort: only an EXISTING record whose door is "Donor Pledge"
// is touched (a plain donor who never pledged gets nothing here, and we never create
// a record). Never throws into the webhook that calls it.

/** Mark the pledger keyed by this email as fulfilled. No-op if they never pledged. */
export async function reconcilePledgeOnGift(email?: string | null, giftCents?: number): Promise<void> {
  if (!dbConfigured || !email) return;
  const sk = `e:${email.trim().toLowerCase()}`;
  const now = new Date().toISOString();
  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.volunteers, SK: sk },
        // Only an existing Donor-Pledge record — never create, never touch a non-pledger.
        ConditionExpression: "attribute_exists(PK) AND #door = :dp",
        ReturnValues: "ALL_NEW",
        UpdateExpression: "SET pledgeFulfilledAt = :t, pledgeFulfilledCents = :c",
        ExpressionAttributeNames: { "#door": "door" },
        ExpressionAttributeValues: {
          ":dp": "Donor Pledge",
          ":t": now,
          ":c": typeof giftCents === "number" && giftCents > 0 ? giftCents : 0,
        },
      }),
    );
    await mirrorVolunteerPledgeFulfilledToAirtable((res.Attributes?.airtableId as string) ?? null).catch(() => {});
  } catch (err) {
    // ConditionalCheckFailed → not a pledger; anything else → log, never throw.
    if ((err as { name?: string })?.name !== "ConditionalCheckFailedException") {
      console.warn("[volunteers] pledge reconcile failed:", err instanceof Error ? err.message : err);
    }
  }
}
