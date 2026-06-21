import crypto from "node:crypto";
import { GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, dbConfigured } from "@/lib/db";
import { getSecret } from "@/lib/ssm";

// Subscriber list with per-topic preferences + one-click unsubscribe
// (email-campaign-plan §3/§4). A broadcast is suppressed when the address is
// globally unsubscribed/bounced/complained, OR opted out of that broadcast's
// topic. Unsubscribe links are stateless: token = base64url(email).hmac.
const SUB_PK = "SUBSCRIBER";
const norm = (e: string) => e.trim().toLowerCase();

// HMAC key for unsubscribe tokens. Resolved at call time via getSecret so it can
// move out of the baked artifact into runtime SSM (infra/SECRETS-MIGRATION.md).
// env-first → no behavior change while UNSUB_SECRET is still baked. Falls back to
// CRON_SECRET (legacy) then a dev-only default, preserving the prior precedence.
async function unsubSecret(): Promise<string> {
  return (
    (await getSecret("UNSUB_SECRET")) ||
    (await getSecret("CRON_SECRET")) ||
    "dev-unsubscribe-secret-change-me"
  );
}

// Subscriber-facing broadcast topics. A subscriber can opt out of any subset
// (per-topic) or unsubscribe globally. Keys are stable; labels are shown on the
// preference center and map 1:1 to broadcast templates.
export const TOPICS = [
  { key: "news", label: "Campaign news & updates" },
  { key: "issues", label: "The issues & where Matt stands" },
  { key: "gotv", label: "Voting & election reminders" },
  { key: "fundraising", label: "Fundraising appeals" },
  { key: "events", label: "Event invitations" },
] as const;
export type TopicKey = (typeof TOPICS)[number]["key"];
const TOPIC_KEYS = new Set<string>(TOPICS.map((t) => t.key));
export const isTopic = (v: unknown): v is TopicKey => typeof v === "string" && TOPIC_KEYS.has(v);

// ───────────────────────── stateless unsubscribe token ─────────────────────────
async function sign(email: string): Promise<string> {
  const secret = await unsubSecret();
  return crypto.createHmac("sha256", secret).update(norm(email)).digest("base64url").slice(0, 24);
}
export async function unsubToken(email: string): Promise<string> {
  return `${Buffer.from(norm(email)).toString("base64url")}.${await sign(email)}`;
}
export async function unsubscribeUrl(baseUrl: string, email: string): Promise<string> {
  return `${baseUrl.replace(/\/$/, "")}/unsubscribe?token=${await unsubToken(email)}`;
}
// RFC 8058 one-click target for the List-Unsubscribe header (handles POST).
export async function unsubscribeApiUrl(baseUrl: string, email: string): Promise<string> {
  return `${baseUrl.replace(/\/$/, "")}/api/unsubscribe?token=${await unsubToken(email)}`;
}
export async function verifyUnsubToken(token: string): Promise<string | null> {
  const [b64, sig] = (token || "").split(".");
  if (!b64 || !sig) return null;
  let email: string;
  try {
    email = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = await sign(email);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return norm(email);
}

// ───────────────────────── preferences / suppression ─────────────────────────
export type SuppressStatus = "unsubscribed" | "bounced" | "complained";
const GLOBALLY_SUPPRESSED = new Set<string>(["unsubscribed", "bounced", "complained"]);
export type Preferences = { status: string; optOut: TopicKey[] };

// Global suppress (one-click unsubscribe, bounces, complaints). Preserves any
// topic opt-out list (Update, not overwrite).
export async function suppress(email: string, status: SuppressStatus = "unsubscribed"): Promise<void> {
  if (!dbConfigured) return;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: SUB_PK, SK: norm(email) },
      UpdateExpression: "SET #s = :s, updatedAt = :u",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status, ":u": new Date().toISOString() },
    }),
  );
}

// Save the preference center: which topics the subscriber is opted OUT of, and
// whether they're globally subscribed. Managing prefs re-subscribes globally.
export async function setPreferences(email: string, optOut: TopicKey[], unsubscribeAll: boolean): Promise<void> {
  if (!dbConfigured) return;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: SUB_PK, SK: norm(email) },
      UpdateExpression: "SET #s = :s, optOut = :o, updatedAt = :u",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":s": unsubscribeAll ? "unsubscribed" : "subscribed",
        ":o": optOut.filter(isTopic),
        ":u": new Date().toISOString(),
      },
    }),
  );
}

export async function getPreferences(email: string): Promise<Preferences> {
  if (!dbConfigured || !email) return { status: "subscribed", optOut: [] };
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: SUB_PK, SK: norm(email) } }));
    const optOut = Array.isArray(r.Item?.optOut) ? (r.Item!.optOut as string[]).filter(isTopic) : [];
    return { status: String(r.Item?.status ?? "subscribed"), optOut };
  } catch {
    return { status: "subscribed", optOut: [] };
  }
}

// All explicit subscriber records (those who unsubscribed, set topic prefs, or
// bounced/complained). People with no record are implicitly subscribed and don't
// appear here — this view is the suppression/preferences ledger.
export type SubscriberRow = { email: string; status: string; optOut: TopicKey[]; updatedAt?: string };
export async function listSubscribers(limit = 500): Promise<SubscriberRow[]> {
  if (!dbConfigured) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": SUB_PK }, Limit: limit }),
    );
    return (r.Items ?? [])
      .map((i) => ({
        email: String(i.SK),
        status: String(i.status ?? "subscribed"),
        optOut: Array.isArray(i.optOut) ? (i.optOut as string[]).filter(isTopic) : [],
        updatedAt: i.updatedAt ? String(i.updatedAt) : undefined,
      }))
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  } catch {
    return [];
  }
}

// Suppressed for a broadcast: globally suppressed, or opted out of its topic.
export async function isSuppressed(email: string, topic?: TopicKey): Promise<boolean> {
  if (!dbConfigured || !email) return false;
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: SUB_PK, SK: norm(email) } }));
    if (!r.Item) return false;
    if (GLOBALLY_SUPPRESSED.has(String(r.Item.status))) return true;
    if (topic && Array.isArray(r.Item.optOut) && (r.Item.optOut as string[]).includes(topic)) return true;
    return false;
  } catch {
    return false;
  }
}
