import { getSecret } from "@/lib/ssm";
import { socialAppParam } from "@/lib/social/credentials";
import { resolveCredentials } from "@/lib/social/publish";

// Readiness for the Meta inbox, mirroring lib/sms/health.ts smsReadiness: report
// WHICH pieces are present without ever leaking a value, so an admin can see what's
// left to wire. Three things are needed to receive + reply:
//   • a Facebook Page access token (reused from the social stack, resolveCredentials)
//   • the Meta app secret (to verify webhook signatures) — already in SSM for OAuth
//   • MESSENGER_VERIFY_TOKEN (the GET-handshake token we register with Meta)
// Going fully live ALSO needs the pages_messaging permission via Meta App Review —
// that's an account-side gate this check can't see (documented in the runbook).

export type MessengerReadiness = {
  pageToken: boolean;
  appSecret: boolean;
  verifyToken: boolean;
  state: "live" | "setup";
};

async function has(v: Promise<unknown>): Promise<boolean> {
  try {
    return !!(await v);
  } catch {
    return false;
  }
}

export async function messengerReadiness(): Promise<MessengerReadiness> {
  const [pageToken, appSecret, verifyToken] = await Promise.all([
    has(resolveCredentials("facebook")),
    has(socialAppParam("facebook", "app_secret")),
    has(getSecret("MESSENGER_VERIFY_TOKEN")),
  ]);
  return { pageToken, appSecret, verifyToken, state: pageToken && appSecret && verifyToken ? "live" : "setup" };
}

/** True only when receiving + replying are both wired (token + secret + verify token). */
export async function messengerEnabled(): Promise<boolean> {
  return (await messengerReadiness()).state === "live";
}
