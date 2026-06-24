// AWS SES send wrapper. Graceful: if SES_FROM isn't set the app still runs and
// callers no-op. Identity verification + production access are configured in SES
// (see candidate/email-campaign-plan.md). Reply-to defaults to the campaign inbox.
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { CAMPAIGN } from "@/lib/site";

const FROM = process.env.SES_FROM ?? ""; // e.g. "Matt Grant for Congress <info@mattgrantforcongress.org>"
const CONFIG_SET = process.env.SES_CONFIG_SET ?? "";
export const sesEnabled = !!FROM;

// maxAttempts makes the SDK's built-in retry explicit: it retries only retryable
// errors (throttling / 5xx / network) with its own backoff — the conservative,
// idempotency-safe send-retry for email (SES has no idempotency key, so a
// hand-rolled retry-after-accept could double-send; the SDK avoids that).
const client = new SESv2Client({ region: process.env.AWS_REGION ?? "us-east-1", maxAttempts: 3 });

// Templates carry per-recipient merge fields like {{unsubscribe_url}} and
// {{preferences_url}} (see lib/email/templates.ts). The send path MUST fill them
// in before the message goes out — an email that ships a literal
// "{{unsubscribe_url}}" has a non-functional unsubscribe link, which violates
// CAN-SPAM/FEC mass-email rules. `tokens` maps a field name to its value; pass
// the recipient's real unsubscribe/preferences URLs per send.
export type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tokens?: Record<string, string>;
  headers?: { name: string; value: string }[]; // e.g. List-Unsubscribe
  tags?: { name: string; value: string }[]; // SES EmailTags → echoed on open/click events
};

const MERGE_TOKEN = /\{\{\s*[\w.]+\s*\}\}/g;

function fillTokens(s: string, tokens?: Record<string, string>): string {
  if (!tokens) return s;
  return s.replace(MERGE_TOKEN, (m) => {
    const key = m.replace(/[{}\s]/g, "");
    return key in tokens ? tokens[key] : m;
  });
}

export async function sendEmail(a: SendArgs): Promise<{ sent: boolean; id?: string; error?: string }> {
  if (!sesEnabled) return { sent: false, error: "SES not configured" };
  const to = Array.isArray(a.to) ? a.to : [a.to];

  const html = fillTokens(a.html, a.tokens);
  const text = a.text ? fillTokens(a.text, a.tokens) : undefined;

  // Safety net: refuse to send if any merge token is still unfilled. This stops a
  // broadcast from going out with a dead unsubscribe/preferences link. Transactional
  // emails carry no tokens, so this never trips them.
  const leftover = html.match(MERGE_TOKEN) ?? text?.match(MERGE_TOKEN);
  if (leftover) {
    return { sent: false, error: `Refusing to send: unfilled merge token ${leftover[0]}. Pass it via tokens.` };
  }

  try {
    const out = await client.send(
      new SendEmailCommand({
        FromEmailAddress: FROM,
        Destination: { ToAddresses: to },
        ReplyToAddresses: [a.replyTo ?? CAMPAIGN.email],
        ...(CONFIG_SET ? { ConfigurationSetName: CONFIG_SET } : {}),
        ...(a.tags?.length
          ? { EmailTags: a.tags.map((t) => ({ Name: t.name, Value: t.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 256) || "na" })) }
          : {}),
        Content: {
          Simple: {
            ...(a.headers?.length ? { Headers: a.headers.map((h) => ({ Name: h.name, Value: h.value })) } : {}),
            Subject: { Data: a.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: html, Charset: "UTF-8" },
              ...(text ? { Text: { Data: text, Charset: "UTF-8" } } : {}),
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
