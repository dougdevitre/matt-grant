import crypto from "node:crypto";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, dbConfigured } from "@/lib/db";

// Broadcast suppression list + one-click unsubscribe (email-campaign-plan §3/§4).
// A broadcast must never go to an unsubscribed/bounced address — CAN-SPAM requires
// a working unsubscribe honored promptly. Unsubscribe links are stateless: the
// token is base64url(email).hmac, so /unsubscribe needs no prior lookup.
const SUB_PK = "SUBSCRIBER";
const SECRET = process.env.UNSUB_SECRET || process.env.CRON_SECRET || "dev-unsubscribe-secret-change-me";
const norm = (e: string) => e.trim().toLowerCase();

function sign(email: string): string {
  return crypto.createHmac("sha256", SECRET).update(norm(email)).digest("base64url").slice(0, 24);
}

export function unsubToken(email: string): string {
  return `${Buffer.from(norm(email)).toString("base64url")}.${sign(email)}`;
}

// Built with the live request host so links resolve on whatever domain served
// the send (the Amplify URL today, the custom domain after cutover).
export function unsubscribeUrl(baseUrl: string, email: string): string {
  return `${baseUrl.replace(/\/$/, "")}/unsubscribe?token=${unsubToken(email)}`;
}

export function verifyUnsubToken(token: string): string | null {
  const [b64, sig] = (token || "").split(".");
  if (!b64 || !sig) return null;
  let email: string;
  try {
    email = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(email);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return norm(email);
}

export async function suppress(email: string, reason = "unsubscribe"): Promise<void> {
  if (!dbConfigured) return;
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: SUB_PK, SK: norm(email), status: "unsubscribed", reason, updatedAt: new Date().toISOString() },
    }),
  );
}

export async function isSuppressed(email: string): Promise<boolean> {
  if (!dbConfigured || !email) return false;
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: SUB_PK, SK: norm(email) } }));
    return r.Item?.status === "unsubscribed" || r.Item?.status === "bounced";
  } catch {
    return false;
  }
}
