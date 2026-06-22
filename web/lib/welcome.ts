import { sesEnabled, sendEmail } from "@/lib/email/send";
import { supporterWelcome } from "@/lib/email/templates";

// Idempotent welcome-email send. Sends the supporter welcome once and records
// `welcomedAt` in Clerk privateMetadata so it never fires twice. Called from BOTH
// the user.created webhook AND the first /community visit — whichever runs first
// welcomes; the other sees the flag and skips. The page-visit path is the
// guarantee: even if the webhook's send fails or the webhook isn't delivered,
// landing in the hub welcomes the user.
//
// The CALLER decides eligibility (is this a public community member?) and whether
// the flag is already set; this helper just does the send + stamp.
export async function ensureWelcomed(opts: {
  userId: string;
  email?: string | null;
  firstName?: string | null;
}): Promise<boolean> {
  if (!sesEnabled || !opts.email) return false;
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const tpl = supporterWelcome((opts.firstName || "there").trim() || "there");
    const res = await sendEmail({ to: opts.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    if (res.sent) {
      await client.users.updateUserMetadata(opts.userId, {
        privateMetadata: { welcomedAt: new Date().toISOString() },
      });
    }
    return res.sent;
  } catch {
    return false;
  }
}
