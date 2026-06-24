import { GetCommand, PutCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { toE164 } from "@/lib/sms/send";

// SMS moderation: a denylist of numbers that may not text us or be texted, plus a
// lightweight profanity flag for inbound triage. Separate from the consent ledger
// (lib/sms/consent.ts) on purpose — consent is "do they want our texts", a block
// is "we don't want theirs". A block wins over everything.
//
// FAIL-OPEN on reads (mirrors lib/ratelimit.ts): if the store hiccups, isBlocked
// returns false so the inbound webhook still acks and the system degrades safely.
const BLOCK_PK = PK.smsBlocks;

export type SmsBlockRow = { phone: string; blockedAt: string; by?: string; reason?: string };

/** Block a number: drops their inbound and refuses outbound to them. Idempotent. */
export async function blockNumber(input: { phone: string; by?: string; reason?: string }): Promise<boolean> {
  const e = toE164(input.phone);
  if (!dbConfigured || !e) return false;
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: BLOCK_PK, SK: e, phone: e, blockedAt: new Date().toISOString(), by: input.by, reason: input.reason },
    }),
  );
  return true;
}

/** Lift a block. Idempotent — deleting a missing row is a no-op. */
export async function unblockNumber(phone: string): Promise<boolean> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return false;
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: BLOCK_PK, SK: e } }));
  return true;
}

/** True when the number is on the denylist. Fail-open: unknown/error → false. */
export async function isBlocked(phone: string): Promise<boolean> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return false;
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: BLOCK_PK, SK: e } }));
    return !!r.Item;
  } catch {
    return false; // fail-open — never wedge the webhook on a read error
  }
}

/** All blocked numbers, for the dashboard to badge conversations + manage the list. */
export async function listBlocked(): Promise<SmsBlockRow[]> {
  if (!dbConfigured) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": BLOCK_PK } }),
    );
    return (r.Items ?? []).map((i) => ({
      phone: String(i.SK),
      blockedAt: String(i.blockedAt ?? ""),
      by: i.by ? String(i.by) : undefined,
      reason: i.reason ? String(i.reason) : undefined,
    }));
  } catch {
    return [];
  }
}

// ── Profanity flag (triage only — NEVER auto-blocks) ─────────────────────────────
// A small curated denylist of slurs/abuse. Whole-word, case-insensitive, so it
// flags "you idiot" but not "Scunthorpe". Inbound hits get a ⚠ badge for a human
// to review and decide whether to Block — a single bad word must not ban a real
// constituent. Intentionally short and conservative; expand only deliberately.
const PROFANITY = [
  "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "dick", "piss",
  "slut", "whore", "faggot", "retard", "nigger", "nigga", "kike", "spic", "wetback",
];

const PROFANITY_RE = new RegExp(`\\b(${PROFANITY.join("|")})\\b`, "i");

export type ProfanityResult = { flagged: boolean; terms: string[] };

/** Flag inappropriate language in an inbound message for staff review. */
export function flagProfanity(text: string): ProfanityResult {
  if (!text) return { flagged: false, terms: [] };
  const terms = new Set<string>();
  for (const m of text.matchAll(new RegExp(PROFANITY_RE, "gi"))) terms.add(m[1].toLowerCase());
  return { flagged: terms.size > 0, terms: [...terms] };
}
