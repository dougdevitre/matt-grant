import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";

// SELF-SCOPED donor lookup for the supporter community hub.
//
// SECURITY: the caller MUST pass the AUTHENTICATED user's own email (gate.email).
// This returns ONLY that one person's giving summary — it reads their single
// donor row by primary key and never lists or exposes anyone else's data. That's
// what makes it safe to surface to a `supporter` (who otherwise has zero donor
// access). Do NOT add a path here that takes an arbitrary/other email from the
// client.
//
// The "Donor" tier is derived, not a stored role: a supporter whose authenticated
// email matches a positive net contribution is shown the donor view. Giving
// instantly unlocks it; a refund that nets to zero removes it — no admin step.

export type DonorSummary = { hasDonated: boolean; totalCents: number; gifts: number };

const NONE: DonorSummary = { hasDonated: false, totalCents: 0, gifts: 0 };

// One gift line for the donor portal (negative amount = a refund/reversal).
export type GiftLine = { amountCents: number; method?: string; election?: string; receivedAt?: string; type?: string };
export type MyGiving = { hasDonated: boolean; totalCents: number; gifts: number; lines: GiftLine[] };

const NO_GIVING: MyGiving = { hasDonated: false, totalCents: 0, gifts: 0, lines: [] };

// SELF-SCOPED full giving history for the donor portal (/my-giving). Same single-
// row-by-primary-key read as donorSummaryForEmail — it reads ONLY the caller's own
// donor row and never lists or exposes anyone else's data, which is what makes it
// safe to show a `donor`. SECURITY: pass the AUTHENTICATED user's own email
// (gate.email) only — never an email taken from the client.
export async function myGiving(email?: string | null): Promise<MyGiving> {
  if (!dbConfigured || !email) return NO_GIVING;
  try {
    const r = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { PK: PK.donors, SK: `e:${email.toLowerCase()}` } }),
    );
    const raw = (r.Item?.contributions as GiftLine[] | undefined) ?? [];
    const lines = [...raw].sort((a, b) => String(b.receivedAt ?? "").localeCompare(String(a.receivedAt ?? "")));
    const totalCents = lines.reduce((sum, c) => sum + (Number(c.amountCents) || 0), 0);
    const gifts = lines.filter((c) => (Number(c.amountCents) || 0) > 0).length;
    return { hasDonated: totalCents > 0, totalCents, gifts, lines };
  } catch {
    return NO_GIVING;
  }
}

export async function donorSummaryForEmail(email?: string | null): Promise<DonorSummary> {
  if (!dbConfigured || !email) return NONE;
  try {
    const r = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { PK: PK.donors, SK: `e:${email.toLowerCase()}` } }),
    );
    const contribs = (r.Item?.contributions as { amountCents?: number }[] | undefined) ?? [];
    const totalCents = contribs.reduce((sum, c) => sum + (Number(c.amountCents) || 0), 0);
    const gifts = contribs.filter((c) => (Number(c.amountCents) || 0) > 0).length;
    // Net positive only — a fully-refunded donor isn't shown the donor view.
    return totalCents > 0 ? { hasDonated: true, totalCents, gifts } : NONE;
  } catch {
    return NONE;
  }
}
