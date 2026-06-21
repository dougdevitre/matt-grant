import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";

// Single source of truth for recording a contribution. Both the manual donor
// form and the WinRed webhook funnel through here so a returning donor's gifts
// accumulate on ONE row in the `contributions[]` array — the shape getDonors()/
// sumContribs() read. (Before this, the webhook wrote a flat `amount` field that
// the dashboard never summed, so WinRed donations showed as $0.)
//
// Dedupe by email; profile fields only overwrite when provided (a later gift that
// omits employer/occupation never wipes FEC info on file). When an externalId is
// given (WinRed's donation id) the append is idempotent, so webhook retries can't
// double-count.

type Contribution = {
  amountCents: number; // negative for a refund/dispute reversal — nets out of the sum
  method?: string;
  election?: string;
  receivedAt?: string;
  externalId?: string;
  type?: string; // "refund" for a reversal; absent for an ordinary gift
};

export type ContributionInput = {
  email?: string | null;
  name?: string | null;
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
};

export async function recordContribution(c: ContributionInput): Promise<void> {
  if (!dbConfigured) return;
  const now = c.receivedAt ?? new Date().toISOString();
  const amountCents = Math.round(c.amountCents ?? 0);
  const key = c.email ? `e:${c.email.toLowerCase()}` : newId();

  // Idempotency: skip if this donation (externalId) is already on the donor.
  if (c.externalId && c.email) {
    const existing = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.donors, SK: key } }));
    const prior = (existing.Item?.contributions as Contribution[] | undefined) ?? [];
    if (prior.some((x) => x.externalId === c.externalId)) return;
  }

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
  set(c.city, "city = :ci", {}, ":ci", c.city);
  set(c.state, "#stt = :stt", { "#stt": "state" }, ":stt", c.state);
  set(c.zip, "zip = :z", {}, ":z", c.zip);
  set(c.employer, "employer = :emp", {}, ":emp", c.employer);
  set(c.occupation, "occupation = :occ", {}, ":occ", c.occupation);
  set(c.source, "#src = :src", { "#src": "source" }, ":src", c.source);
  set(typeof c.recurring === "boolean", "recurring = :rec", {}, ":rec", !!c.recurring);

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.donors, SK: key },
      UpdateExpression: "SET " + sets.join(", "),
      ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
      ExpressionAttributeValues: values,
    }),
  );
}
