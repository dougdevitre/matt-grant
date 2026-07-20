import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, dbConfigured, queryAllPages } from "@/lib/db";
import { toE164 } from "@/lib/sms/send";

// SMS consent ledger — the TCPA gate for broadcast texting. A number is texted
// ONLY when it has an explicit `opted_in` record here; unknown numbers (no row)
// are never texted. Keyed by E.164 phone. Opt-out (STOP) and re-subscribe (START)
// flip the status; we mirror Twilio's carrier-level Advanced Opt-Out so audience
// resolution stays correct. Analogous to lib/subscribers.ts for email.
const SMS_PK = "SMSCONSENT";

export type SmsConsentStatus = "opted_in" | "opted_out";
// Beyond the consent core, a row may carry targeting metadata: self-reported
// geography from the SMS vote agent (geoSource "self") and the denormalized
// voter tags the out-of-band enrichment job writes (scripts/enrich-sms-audience.ts
// — geoSource "voterfile"/"contact"). These are plain fields ON the consent row;
// nothing here reads voter data, and targeting on them only NARROWS the
// opted-in audience (candidate/sms-targeting-plan.md §2).
export type SmsConsentRow = {
  phone: string;
  status: SmsConsentStatus;
  source?: string;
  consentAt?: string;
  updatedAt?: string;
  county?: string; // CountyKey (lib/sms/geo.ts)
  zip?: string;
  geoSource?: string; // "self" | "voterfile" | "contact"
  voterSegment?: string; // MOBILIZE/BANK/PERSUADE/PROSPECT/MONITOR (denormalized)
  voterT?: number; // turnout score 0-5 (denormalized)
  banked?: boolean; // confirmed already voted (ballot returns, denormalized)
};

/** Record explicit opt-in (web checkbox, inbound keyword, START). Re-subscribes an opted-out number.
 *  `consentAt` overrides the stored first-consent timestamp — pass the ORIGINAL opt-in time when
 *  backfilling historical records; omit it for live opt-ins (defaults to now). Either way it's only
 *  set on first write (if_not_exists), so re-running never clobbers an existing consent date. */
export async function recordConsent(phone: string, source: string, consentAt?: string): Promise<boolean> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return false;
  const now = new Date().toISOString();
  const at = consentAt ?? now;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: SMS_PK, SK: e },
      UpdateExpression: "SET #s = :in, #src = if_not_exists(#src, :src), consentAt = if_not_exists(consentAt, :at), updatedAt = :u",
      ExpressionAttributeNames: { "#s": "status", "#src": "source" },
      ExpressionAttributeValues: { ":in": "opted_in", ":src": source, ":at": at, ":u": now },
    }),
  );
  return true;
}

/** Annotate an EXISTING consent row with self-reported geography (county key +
 *  optional ZIP5) from the SMS vote agent. Never creates a row — geography is
 *  metadata on a consent record, not consent itself. This is the self-reported
 *  side of the audience-enrichment fields (candidate/sms-targeting-plan.md §2);
 *  composer geo filters read these plain fields only. */
export async function recordConsentGeo(phone: string, geo: { county: string; zip?: string }): Promise<boolean> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return false;
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: SMS_PK, SK: e },
        // geoSource "self" marks it self-reported — the enrichment job never
        // overwrites it (the person's own answer beats a voter-file match).
        UpdateExpression: "SET county = :c, geoSource = :g, updatedAt = :u" + (geo.zip ? ", zip = :z" : ""),
        ConditionExpression: "attribute_exists(SK)",
        ExpressionAttributeValues: {
          ":c": geo.county,
          ":g": "self",
          ":u": new Date().toISOString(),
          ...(geo.zip ? { ":z": geo.zip } : {}),
        },
      }),
    );
    return true;
  } catch {
    return false; // no consent row (or transient error) — nothing to annotate
  }
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
    // Paginate the whole ledger: optedInSet() builds broadcast audiences from this,
    // so a single 1 MB page would silently omit every opted-in number past the
    // boundary — they'd never receive an "all opted-in" text, and counts would be low.
    const items = await queryAllPages({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": SMS_PK } });
    return items.map((i) => ({
      phone: String(i.SK),
      status: (i.status === "opted_in" ? "opted_in" : "opted_out") as SmsConsentStatus,
      source: i.source ? String(i.source) : undefined,
      consentAt: i.consentAt ? String(i.consentAt) : undefined,
      updatedAt: i.updatedAt ? String(i.updatedAt) : undefined,
      county: i.county ? String(i.county) : undefined,
      zip: i.zip ? String(i.zip) : undefined,
      geoSource: i.geoSource ? String(i.geoSource) : undefined,
      voterSegment: i.voterSegment ? String(i.voterSegment) : undefined,
      voterT: typeof i.voterT === "number" ? i.voterT : undefined,
      banked: typeof i.banked === "boolean" ? i.banked : undefined,
    }));
  } catch {
    return [];
  }
}

/** The set of opted-in E.164 numbers — for filtering an audience in one read. */
export async function optedInSet(): Promise<Set<string>> {
  return new Set((await listConsent()).filter((c) => c.status === "opted_in").map((c) => c.phone));
}
