import { NextResponse, type NextRequest } from "next/server";
import { verifySnsMessage } from "@/lib/sns";
import { suppress } from "@/lib/subscribers";

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
    let event: {
      eventType?: string;
      notificationType?: string;
      bounce?: { bounceType?: string; bouncedRecipients?: { emailAddress?: string }[] };
      complaint?: { complainedRecipients?: { emailAddress?: string }[] };
    };
    try {
      event = JSON.parse(msg.Message);
    } catch {
      return NextResponse.json({ ok: true, note: "unparsable message" });
    }
    const kind = event.eventType ?? event.notificationType;
    const emails: string[] = [];
    if (kind === "Bounce" && event.bounce?.bounceType === "Permanent") {
      for (const r of event.bounce.bouncedRecipients ?? []) if (r.emailAddress) emails.push(r.emailAddress);
    } else if (kind === "Complaint") {
      for (const r of event.complaint?.complainedRecipients ?? []) if (r.emailAddress) emails.push(r.emailAddress);
    }
    for (const e of emails) {
      try {
        await suppress(e, kind === "Complaint" ? "complained" : "bounced");
      } catch {
        /* best-effort */
      }
    }
    return NextResponse.json({ ok: true, suppressed: emails.length });
  }

  return NextResponse.json({ ok: true });
}
