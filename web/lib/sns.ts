import crypto from "node:crypto";

// Verifies an Amazon SNS message signature so a forged POST can't inject fake
// bounces/complaints into the suppression list. Implements the documented
// canonical string + RSA verify against the message's signing cert (no extra
// dependency). https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
type SnsMessage = Record<string, string>;

const KEYS_NOTIFICATION = ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"];
const KEYS_SUBSCRIPTION = ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];

function stringToSign(m: SnsMessage): string {
  const keys = m.Type === "Notification" ? KEYS_NOTIFICATION : KEYS_SUBSCRIPTION;
  let s = "";
  for (const k of keys) {
    if (m[k] === undefined) continue; // Subject is optional
    s += `${k}\n${m[k]}\n`;
  }
  return s;
}

async function fetchCert(url: string): Promise<string> {
  const u = new URL(url);
  // Only ever fetch the signing cert from an AWS host over HTTPS.
  if (u.protocol !== "https:" || !u.hostname.endsWith(".amazonaws.com")) {
    throw new Error("untrusted SigningCertURL");
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("cert fetch failed");
  return await res.text();
}

export async function verifySnsMessage(m: SnsMessage): Promise<boolean> {
  try {
    if (!m.Signature || !m.SigningCertURL) return false;
    const cert = await fetchCert(m.SigningCertURL);
    const algo = m.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
    const verifier = crypto.createVerify(algo);
    verifier.update(stringToSign(m), "utf8");
    return verifier.verify(cert, m.Signature, "base64");
  } catch {
    return false;
  }
}
