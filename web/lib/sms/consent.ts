import { GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, dbConfigured } from "@/lib/db";
import { toE164 } from "@/lib/sms/send";

// SMS consent ledger — the TCPA gate for broadcast texting. A number is texted
// ONLY when it has an explicit `opted_in` record here; unknown numbers (no row)
// are never texted. Keyed by E.164 phone. Opt-out (STOP) and re-subscribe (START)
// flip the status; we mirror Twilio's carrier-level Advanced Opt-Out so audience
// resolution stays correct. Analogous to lib/subscribers.ts for email.
const SMS_PK = "SMSCONSENT";

export type SmsConsentStatus = "opted_in" | "opted_out";
export type SmsConsentRow = { phone: string; status: SmsConsentStatus; source?: string; consentAt?: string; updatedAt?: string };

/** Record explicit opt-in (web checkbox, inbound keyword, START). Re-subscribes an opted-out number. */
export async function recordConsent(phone: string, source: string): Promise<boolean> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return false;
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: SMS_PK, SK: e },
      UpdateExpression: "SET #s = :in, #src = if_not_exists(#src, :src), consentAt = if_not_exists(consentAt, :u), updatedAt = :u",
      ExpressionAttributeNames: { "#s": "status", "#src": "source" },
      ExpressionAttributeValues: { ":in": "opted_in", ":src": source, ":u": now },
    }),
  );
  return true;
}

/** Record opt-out (STOP / carrier). Creates the row if the number was never seen. */
export async function recordOptOut(phone: string): Promise<boolean> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return false;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: SMS_PK, SK: e },
      UpdateExpression: "SET #s = :out, updatedAt = :u, optedOutAt = :u",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":out": "opted_out", ":u": new Date().toISOString() },
    }),
  );
  return true;
}

/** True only when the number has an explicit opted_in record. Unknown → false. */
export async function isOptedIn(phone: string): Promise<boolean> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return false;
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: SMS_PK, SK: e } }));
    return r.Item?.status === "opted_in";
  } catch {
    return false;
  }
}

/** The recorded status for one number: opted_in / opted_out / unknown (no row). */
export async function consentStatus(phone: string): Promise<SmsConsentStatus | "unknown"> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return "unknown";
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: SMS_PK, SK: e } }));
    const s = r.Item?.status;
    return s === "opted_in" ? "opted_in" : s === "opted_out" ? "opted_out" : "unknown";
  } catch {
    return "unknown";
  }
}

/** The full consent ledger (for the dashboard + audience filtering). */
export async function listConsent(): Promise<SmsConsentRow[]> {
  if (!dbConfigured) return [];
  try {
    const r = await ddb.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": SMS_PK } }));
    return (r.Items ?? []).map((i) => ({
      phone: String(i.SK),
      status: (i.status === "opted_in" ? "opted_in" : "opted_out") as SmsConsentStatus,
      source: i.source ? String(i.source) : undefined,
      consentAt: i.consentAt ? String(i.consentAt) : undefined,
      updatedAt: i.updatedAt ? String(i.updatedAt) : undefined,
    }));
  } catch {
    return [];
  }
}

/** The set of opted-in E.164 numbers — for filtering an audience in one read. */
export async function optedInSet(): Promise<Set<string>> {
  return new Set((await listConsent()).filter((c) => c.status === "opted_in").map((c) => c.phone));
}
