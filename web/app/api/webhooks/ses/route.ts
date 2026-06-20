import { NextResponse, type NextRequest } from "next/server";
import { verifySnsMessage } from "@/lib/sns";
import { suppress } from "@/lib/subscribers";
import { recordEngagement } from "@/lib/campaigns";
import { classifySesEvent, type SesEvent } from "@/lib/sesEvents";

// SES → SNS deliverability webhook (email-campaign-plan §2). Permanent bounces
// and complaints auto-suppress the address so we stop mailing it — protecting
// sender reputation and honoring complaints. SNS signature is verified; an
// optional SES_SNS_TOPIC_ARN pins the source topic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SnsEnvelope = {
  Type?: string;
  TopicArn?: string;
  Message?: string;
  SubscribeURL?: string;
  [k: string]: unknown;
};

export async function POST(req: NextRequest) {
  let msg: SnsEnvelope;
  try {
    msg = (await req.json()) as SnsEnvelope;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const expectedTopic = process.env.SES_SNS_TOPIC_ARN;
  if (expectedTopic && msg.TopicArn !== expectedTopic) {
    return NextResponse.json({ ok: false, error: "unexpected topic" }, { status: 403 });
  }
  if (!(await verifySnsMessage(msg as Record<string, string>))) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 403 });
  }

  // First-time setup: SNS sends a confirmation we must accept.
  if (msg.Type === "SubscriptionConfirmation" && msg.SubscribeURL) {
    try {
      await fetch(msg.SubscribeURL);
    } catch {
      /* AWS retries */
    }
    return NextResponse.json({ ok: true, confirmed: true });
  }

  if (msg.Type === "Notification" && typeof msg.Message === "string") {
    let event: SesEvent;
    try {
      event = JSON.parse(msg.Message);
    } catch {
      return NextResponse.json({ ok: true, note: "unparsable message" });
    }

    const action = classifySesEvent(event);
    if (action.kind === "engagement") {
      await recordEngagement(action.campaignId, action.event);
      return NextResponse.json({ ok: true, recorded: action.event });
    }
    if (action.kind === "suppress") {
      for (const e of action.emails) {
        try {
          await suppress(e, action.reason);
        } catch {
          /* best-effort */
        }
      }
      return NextResponse.json({ ok: true, suppressed: action.emails.length });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
