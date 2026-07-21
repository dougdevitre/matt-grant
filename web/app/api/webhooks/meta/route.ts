import { NextResponse, type NextRequest } from "next/server";
import { getSecret } from "@/lib/ssm";
import { socialAppParam } from "@/lib/social/credentials";
import { verifyMetaSignature, verifyChallengeToken } from "@/lib/messenger/signature";
import { logInbound, isSenderBlocked, convoKey, type MetaPlatform } from "@/lib/messenger/conversations";
import { notifyStaffInboundMessenger } from "@/lib/notifications/staffNotify";

// Inbound Meta webhook — one endpoint for Facebook Messenger + Instagram DMs.
//   GET  : subscription handshake. Meta sends hub.mode/hub.verify_token/hub.challenge;
//          we echo the challenge only when the verify token matches the one we
//          registered in the Meta App Dashboard (MESSENGER_VERIFY_TOKEN).
//   POST : message events. Verify X-Hub-Signature-256 over the RAW body with the
//          Meta app secret, then log each inbound message and alert staff on the
//          first unread. NEVER auto-replies — replies are human-only from the inbox.
// Inert until the app secret + verify token are configured (403), mirroring the
// keyless-Twilio-webhook posture, so a partial deploy is safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET verification handshake.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge") ?? "";
  const configured = await getSecret("MESSENGER_VERIFY_TOKEN").catch(() => undefined);
  if (mode === "subscribe" && verifyChallengeToken(configured ?? undefined, token)) {
    return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new NextResponse("forbidden", { status: 403 });
}

type MetaMessaging = {
  sender?: { id?: string };
  message?: { mid?: string; text?: string; is_echo?: boolean };
};
type MetaEntry = { messaging?: MetaMessaging[] };
type MetaBody = { object?: string; entry?: MetaEntry[] };

function platformFor(object: string | undefined): MetaPlatform | null {
  if (object === "page") return "messenger";
  if (object === "instagram") return "instagram";
  return null;
}

export async function POST(req: NextRequest) {
  // Raw body FIRST — the signature is over the exact bytes Meta sent.
  const raw = await req.text();
  const appSecret = await socialAppParam("facebook", "app_secret").catch(() => undefined);
  if (!verifyMetaSignature(appSecret, raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  let body: MetaBody;
  try {
    body = JSON.parse(raw) as MetaBody;
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const platform = platformFor(body.object);
  // Best-effort: log + alert, but always ack 200 so Meta doesn't retry-storm us.
  try {
    if (platform) {
      for (const entry of body.entry ?? []) {
        for (const ev of entry.messaging ?? []) {
          const psid = ev.sender?.id;
          const text = ev.message?.text;
          // Skip our own echoes and non-text events (attachments/read/delivery).
          if (!psid || ev.message?.is_echo || !text) continue;
          const unread = await logInbound({ platform, psid, body: text, mid: ev.message?.mid });
          if (unread === 1 && !(await isSenderBlocked(convoKey(platform, psid)))) {
            await notifyStaffInboundMessenger({
              key: convoKey(platform, psid),
              channel: platform === "instagram" ? "Instagram" : "Messenger",
              bodySnippet: text.slice(0, 140),
            }).catch(() => {});
          }
        }
      }
    }
  } catch {
    /* logging failure must not trigger a Meta retry — we already verified the sig */
  }

  return new NextResponse("EVENT_RECEIVED", { status: 200, headers: { "content-type": "text/plain" } });
}
