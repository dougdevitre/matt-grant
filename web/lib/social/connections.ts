import { PutCommand, GetCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, dbConfigured } from "@/lib/db";
import type { ChannelId } from "@/lib/social/channels";

// Per-account OAuth tokens obtained via the in-app connect flow. One DynamoDB
// partition (SOCIALAUTH), SK = platform. Stores the access/page token + the
// resolved account ids so the publishers can post without a human re-auth. The
// Meta record carries both the Facebook Page and (if linked) the Instagram
// business account, since one Meta connect yields both.
const AUTH_PK = "SOCIALAUTH";

export type SocialConnection = {
  platform: string; // "facebook" (Meta — covers IG), "x", "linkedin", …
  // Facebook Page
  pageId?: string;
  pageName?: string;
  pageToken?: string;
  // Instagram business account linked to that Page
  igUserId?: string;
  igUsername?: string;
  // Generic (X / LinkedIn)
  accessToken?: string;
  authorUrn?: string;
  // Bookkeeping
  userToken?: string; // long-lived user token (for refresh/debug)
  expiresAt?: string; // ISO; absent = long-lived/no expiry
  scopes?: string;
  connectedBy: string;
  connectedAt: string;
};

export async function getConnection(platform: string): Promise<SocialConnection | null> {
  if (!dbConfigured) return null;
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: AUTH_PK, SK: platform } }));
    return r.Item ? (stripKeys(r.Item) as SocialConnection) : null;
  } catch {
    return null;
  }
}

export async function saveConnection(conn: SocialConnection): Promise<void> {
  if (!dbConfigured) return;
  await ddb.send(new PutCommand({ TableName: TABLE, Item: { PK: AUTH_PK, SK: conn.platform, ...conn } }));
}

export async function deleteConnection(platform: string): Promise<void> {
  if (!dbConfigured) return;
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: AUTH_PK, SK: platform } })).catch(() => {});
}

export async function listConnections(): Promise<SocialConnection[]> {
  if (!dbConfigured) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": AUTH_PK } }),
    );
    return (r.Items ?? []).map((i) => stripKeys(i) as SocialConnection);
  } catch {
    return [];
  }
}

function stripKeys(item: Record<string, unknown>): Record<string, unknown> {
  const { PK: _pk, SK: _sk, ...rest } = item;
  return rest;
}

// Which channels a stored connection can satisfy. Meta's "facebook" connection
// also powers Instagram (publish uses the Page token + linked IG account).
export function connectionCovers(conn: SocialConnection): ChannelId[] {
  const out: ChannelId[] = [];
  if (conn.platform === "facebook") {
    if (conn.pageToken && conn.pageId) out.push("facebook");
    if (conn.pageToken && conn.igUserId) out.push("instagram");
  }
  if (conn.platform === "x" && conn.accessToken) out.push("x");
  if (conn.platform === "linkedin" && conn.accessToken && conn.authorUrn) out.push("linkedin");
  return out;
}
