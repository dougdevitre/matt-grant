import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";

// Single source of truth for recording a contribution. Both the manual donor
// form and the WinRed webhook funnel through here so a returning donor's gifts
// accumulate on ONE row in the `contributions[]` array — the shape getDonors()/
// sumContribs() read. (Before this, the webhook wrote a flat `amount` field that
// the dashboard never summed, so WinRed donations showed as $0.)
//
// Row key is the donor's email (or the donation's externalId when no email is
// present); profile fields only overwrite when provided (a later gift that omits
// employer/occupation never wipes FEC info on file). Each externalId is recorded
// in a `seenIds` set under a ConditionExpression, so the append is atomically
// idempotent — concurrent or retried webhook deliveries can't double-count.

type Contribution = {
  amountCents: number; // negative for a refund/dispute reversal — nets out of the sum
  method?: string;
  election?: string;
  receivedAt?: string;
  externalId?: string;
  type?: string; // "refund" for a reversal; absent for an ordinary gift
  sc?: string; // WinRed source code — which button/letter/email drove the gift
};

export type ContributionInput = {
  email?: string | null;
  name?: string | null;
  phone?: string | null; // donor mobile (from WinRed) — stored for SMS receipts/thank-yous
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  employer?: string | null;
  occupation?: string | null;
  amountCents?: number; // negative to reverse a prior gift (refund/dispute)
  method?: string;
  election?: string;
  source?: string;
  externalId?: string | null;
  recurring?: boolean;
  receivedAt?: string;
  type?: string; // "refund" tags a reversal entry
  sc?: string | null; // WinRed source code (attribution; stored on the line item)
};

// Stamp a donor as thanked (admin-sent thank-you). Keyed by the donor row's SK.
export async function markThanked(id: string): Promise<void> {
  if (!dbConfigured || !id) return;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.donors, SK: id },
      UpdateExpression: "SET thankedAt = :t",
      ExpressionAttributeValues: { ":t": new Date().toISOString() },
    }),
  );
}

/**
 * Record a contribution. Returns `true` when this call actually recorded a NEW gift and
 * `false` for a duplicate delivery (same externalId already in `seenIds`) or an unconfigured
 * store — so the WinRed webhook can gate its side effects (thank-you email/SMS, admin notify)
 * and a retried delivery can't double-text a donor. A gift with no externalId can't be
 * deduped and is treated as new (unchanged behavior).
 */
export async function recordContribution(c: ContributionInput): Promise<boolean> {
  if (!dbConfigured) return false;
  const now = c.receivedAt ?? new Date().toISOString();
  const amountCents = Math.round(c.amountCents ?? 0);
  // Row key: group a returning donor's gifts by email. With no email, fall back
  // to the donation's own externalId so webhook retries still collapse onto one
  // row (previously each retry got a random key → the same gift stored N times).
  const key = c.email ? `e:${c.email.toLowerCase()}` : c.externalId ? `x:${c.externalId}` : newId();

  // Append for any non-zero amount: positive is a gift, negative reverses one
  // (a WinRed refund/dispute) so getDonors()/sumContribs() net it out naturally.
  const contribs: Contribution[] =
    amountCents !== 0
      ? [{
          amountCents,
          method: c.method ?? "WinRed",
          election: c.election ?? "PRIMARY",
          receivedAt: now,
          ...(c.externalId ? { externalId: c.externalId } : {}),
          ...(c.type ? { type: c.type } : {}),
          ...(c.sc ? { sc: c.sc } : {}),
        }]
      : [];

  const sets = [
    "createdAt = if_not_exists(createdAt, :now)",
    "updatedAt = :now",
    "contributions = list_append(if_not_exists(contributions, :empty), :new)",
  ];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ":now": now, ":empty": [], ":new": contribs };
  const set = (cond: unknown, expr: string, nameMap: Record<string, string>, vKey: string, vVal: unknown) => {
    if (cond) {
      sets.push(expr);
      Object.assign(names, nameMap);
      values[vKey] = vVal;
    }
  };
  // name / state / source are DynamoDB reserved words → aliased.
  set(c.name, "#n = :n", { "#n": "name" }, ":n", c.name);
  set(c.email, "email = :em", {}, ":em", c.email?.toLowerCase());
  set(c.phone, "phone = :ph", {}, ":ph", c.phone);
  set(c.city, "city = :ci", {}, ":ci", c.city);
  set(c.state, "#stt = :stt", { "#stt": "state" }, ":stt", c.state);
  set(c.zip, "zip = :z", {}, ":z", c.zip);
  set(c.employer, "employer = :emp", {}, ":emp", c.employer);
  set(c.occupation, "occupation = :occ", {}, ":occ", c.occupation);
  set(c.source, "#src = :src", { "#src": "source" }, ":src", c.source);
  set(typeof c.recurring === "boolean", "recurring = :rec", {}, ":rec", !!c.recurring);

  // Idempotency: track each donation's externalId in a set and only append when
  // it's new. The condition + ADD execute as one atomic UpdateItem, so two
  // concurrent deliveries of the same WinRed gift can't both append — the loser
  // fails the ConditionExpression and we treat it as a no-op.
  let UpdateExpression = "SET " + sets.join(", ");
  let ConditionExpression: string | undefined;
  if (c.externalId) {
    UpdateExpression += " ADD seenIds :xidset";
    values[":xidset"] = new Set([c.externalId]);
    values[":xid"] = c.externalId;
    ConditionExpression = "attribute_not_exists(seenIds) OR NOT contains(seenIds, :xid)";
  }

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.donors, SK: key },
        UpdateExpression,
        ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
        ExpressionAttributeValues: values,
        ...(ConditionExpression ? { ConditionExpression } : {}),
      }),
    );
    return true;
  } catch (err) {
    // A duplicate delivery of a gift already recorded — idempotent no-op, and the caller
    // must NOT re-fire receipts/notifications for it.
    if ((err as { name?: string })?.name === "ConditionalCheckFailedException") return false;
    throw err;
  }
}
