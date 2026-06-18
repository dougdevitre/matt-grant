// AWS SES send wrapper. Graceful: if SES_FROM isn't set the app still runs and
// callers no-op. Identity verification + production access are configured in SES
// (see candidate/email-campaign-plan.md). Reply-to defaults to the campaign inbox.
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { CAMPAIGN } from "@/lib/site";

const FROM = process.env.SES_FROM ?? ""; // e.g. "Matt Grant for Congress <info@mattgrantforcongress.org>"
const CONFIG_SET = process.env.SES_CONFIG_SET ?? "";
export const sesEnabled = !!FROM;

const client = new SESv2Client({ region: process.env.AWS_REGION ?? "us-east-1" });

export type SendArgs = { to: string | string[]; subject: string; html: string; text?: string; replyTo?: string };

export async function sendEmail(a: SendArgs): Promise<{ sent: boolean; id?: string; error?: string }> {
  if (!sesEnabled) return { sent: false, error: "SES not configured" };
  const to = Array.isArray(a.to) ? a.to : [a.to];
  try {
    const out = await client.send(
      new SendEmailCommand({
        FromEmailAddress: FROM,
        Destination: { ToAddresses: to },
        ReplyToAddresses: [a.replyTo ?? CAMPAIGN.email],
        ...(CONFIG_SET ? { ConfigurationSetName: CONFIG_SET } : {}),
        Content: {
          Simple: {
            Subject: { Data: a.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: a.html, Charset: "UTF-8" },
              ...(a.text ? { Text: { Data: a.text, Charset: "UTF-8" } } : {}),
            },
          },
        },
      }),
    );
    return { sent: true, id: out.MessageId };
  } catch (err) {
    return { sent: false, error: String(err) };
  }
}
