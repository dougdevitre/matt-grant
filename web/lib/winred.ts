// WinRed donation-webhook payload normalizer. Extracted from the route handler so
// this money-parsing of untrusted external input is unit-testable (winred.test.ts).
// Pure — the route owns auth, persistence, and the receipt email.

type Json = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// First present value across candidate dot-paths.
function pick(obj: Json, ...paths: string[]): unknown {
  for (const p of paths) {
    const v = p.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Json)[k] : undefined), obj);
    if (v != null) return v;
  }
  return undefined;
}

export type NormalizedDonation = {
  externalId?: string;
  amount?: number; // dollars
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  city?: string;
  state?: string;
  zip?: string;
  employer?: string;
  occupation?: string;
  recurring: boolean;
  donatedAt?: string;
};

// Token extraction for webhook auth. WinRed's webhook config has NO header or
// signature field — it only lets you add a STATIC FIELD to the JSON body (under
// "Donation Webhook Fields"). We read that `token` (top-level, or nested under a
// `data` wrapper); a header fallback (Bearer / x-winred-token) is kept so manual
// or direct test posts still work. Pure so the route's auth is unit-testable.
export function extractWinredToken(
  payload: Json,
  authorization: string | null,
  xWinredToken: string | null,
): string {
  if (typeof payload.token === "string" && payload.token) return payload.token;
  const data = payload.data && typeof payload.data === "object" ? (payload.data as Json) : null;
  if (data && typeof data.token === "string" && data.token) return data.token;
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  return bearer || xWinredToken || "";
}

export function normalizeWinred(payload: Json): NormalizedDonation {
  // Some webhook configs wrap the donation as { data: {...} }.
  const d = (payload.data && typeof payload.data === "object" ? (payload.data as Json) : payload) as Json;

  const cents = Number(pick(d, "amount", "amount_cents", "donation.amount", "total_amount"));
  const amountDollars = Number.isFinite(cents) && cents > 0 ? Math.round(cents) / 100 : undefined;

  const first = str(pick(d, "donor.first_name", "first_name", "billing.first_name"));
  const last = str(pick(d, "donor.last_name", "last_name", "billing.last_name"));
  const email = str(pick(d, "donor.email", "email", "billing.email"));

  return {
    externalId: str(pick(d, "id", "donation.id", "transaction_id")),
    amount: amountDollars,
    firstName: first,
    lastName: last,
    name: [first, last].filter(Boolean).join(" ") || undefined,
    email,
    city: str(pick(d, "donor.city", "billing.city", "city")),
    state: str(pick(d, "donor.state", "billing.state", "state")),
    zip: str(pick(d, "donor.zip", "billing.zip", "zip")),
    employer: str(pick(d, "donor.employer", "employer")),
    occupation: str(pick(d, "donor.occupation", "occupation")),
    recurring: Boolean(pick(d, "recurring", "is_recurring")),
    donatedAt: str(pick(d, "created_at", "donation.created_at", "timestamp")),
  };
}
