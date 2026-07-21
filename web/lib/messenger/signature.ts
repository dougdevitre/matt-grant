import crypto from "node:crypto";

// Meta webhook security (Facebook Messenger + Instagram DMs share one webhook).
// Two checks, mirroring the SMS/Twilio verify-first pattern:
//   • GET subscription handshake: Meta calls with hub.mode/hub.verify_token/
//     hub.challenge; we echo the challenge only when the verify token matches the
//     one we registered in the Meta App Dashboard (MESSENGER_VERIFY_TOKEN).
//   • POST payloads: Meta signs the RAW body with the app secret; we recompute
//     `sha256=HMAC(app_secret, rawBody)` and timing-safe compare the
//     X-Hub-Signature-256 header before trusting anything in the body.

/** Timing-safe equality with a length guard (compare never throws on mismatch). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** The value Meta puts in X-Hub-Signature-256 for a given raw body + app secret. */
export function expectedMetaSignature(appSecret: string, rawBody: string): string {
  return "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
}

/** Verify an inbound Meta webhook POST. False when the secret is missing, the
 *  header is absent/malformed, or the digest doesn't match — so an unsigned or
 *  forged request is rejected exactly like a bad Twilio signature. */
export function verifyMetaSignature(appSecret: string | undefined, rawBody: string, header: string | null): boolean {
  if (!appSecret || !header || !header.startsWith("sha256=")) return false;
  return safeEqual(expectedMetaSignature(appSecret, rawBody), header);
}

/** Verify the GET subscription handshake token against the configured verify token. */
export function verifyChallengeToken(configured: string | undefined, provided: string | null): boolean {
  if (!configured || !provided) return false;
  return safeEqual(configured, provided);
}
