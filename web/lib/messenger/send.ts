import { META_GRAPH } from "@/lib/social/credentials";
import { resolveCredentials } from "@/lib/social/publish";
import {
  convoKey,
  getConversation,
  isSenderBlocked,
  canReplyNow,
  logOutbound,
  type MetaPlatform,
} from "@/lib/messenger/conversations";

// Send a 1:1 reply on Facebook Messenger or Instagram DMs. HUMAN-INITIATED ONLY —
// called from the dashboard reply action, never from the webhook (no auto-replies).
// Reuses the social stack's Page-token resolution (resolveCredentials("facebook"))
// and gates every send on: configured creds → not blocked → inside Meta's 24h
// standard-messaging window. The outbound is logged either way so a failed send is
// visible in the thread.

export type MessengerSendResult = { sent: boolean; reason?: string; mid?: string };

/** JSON POST to a Graph messaging endpoint (metaPost in publish.ts is form-encoded;
 *  the Send API wants JSON). Returns the message id or a client-safe error. */
async function graphMessage(
  endpoint: string,
  token: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; mid?: string } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${META_GRAPH}/${endpoint}?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error reaching Meta" };
  }
  const body = (await res.json().catch(() => ({}))) as { message_id?: string; error?: { message?: string } };
  if (!res.ok) return { ok: false, error: body.error?.message || `Meta returned ${res.status}` };
  return { ok: true, mid: body.message_id };
}

export async function sendMessengerReply(input: {
  platform: MetaPlatform;
  psid: string;
  text: string;
  by?: string;
}): Promise<MessengerSendResult> {
  const text = (input.text ?? "").trim();
  if (!input.psid) return { sent: false, reason: "Missing the recipient id." };
  if (!text) return { sent: false, reason: "Write a message first." };

  const key = convoKey(input.platform, input.psid);
  const [creds, blocked, convo] = await Promise.all([
    resolveCredentials("facebook"),
    isSenderBlocked(key),
    getConversation(key),
  ]);
  if (!creds?.token) return { sent: false, reason: "Messenger isn't connected yet — an admin needs to finish the Meta setup." };

  const decision = canReplyNow({ blocked, lastInboundAt: convo?.lastInboundAt });
  if (!decision.allowed) return { sent: false, reason: decision.reason };

  // Messenger replies via the Page's /me/messages; Instagram DMs via the linked
  // IG account's /{ig-user-id}/messages (both authorized by the Page token).
  const igUserId = (await resolveCredentials("instagram"))?.accountId;
  if (input.platform === "instagram" && !igUserId)
    return { sent: false, reason: "Instagram isn't linked to the Page yet — connect the Instagram business account." };
  const endpoint = input.platform === "instagram" ? `${igUserId}/messages` : "me/messages";
  const payload = {
    recipient: { id: input.psid },
    messaging_type: "RESPONSE",
    message: { text },
  };

  const r = await graphMessage(endpoint, creds.token, payload);
  await logOutbound({
    platform: input.platform,
    psid: input.psid,
    body: text,
    mid: r.ok ? r.mid : undefined,
    status: r.ok ? "sent" : "failed",
    by: input.by,
  });
  return r.ok ? { sent: true, mid: r.mid } : { sent: false, reason: r.error };
}
