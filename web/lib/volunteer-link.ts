// Stateless signed links so a volunteer (who has no login) can open a private
// page to see and update their assigned tasks. The link carries the volunteer
// id plus an HMAC signature; nothing is stored. Mirrors the unsubscribe-token
// pattern in lib/subscribers.ts. The secret is read env-first, then SSM. When no
// secret is configured, signing returns null and verification fails closed —
// the feature is simply off, with no insecure fallback.
import crypto from "node:crypto";
import { getSecret } from "@/lib/ssm";

async function secret(): Promise<string> {
  return process.env.VOLUNTEER_LINK_SECRET || (await getSecret("VOLUNTEER_LINK_SECRET")) || "";
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function sign(id: string, key: string): string {
  return crypto.createHmac("sha256", key).update(id).digest("base64url").slice(0, 24);
}

/** `${b64url(id)}.${sig}` — or null when no secret is configured (feature off). */
export async function signVolunteerToken(id: string): Promise<string | null> {
  const key = await secret();
  if (!key || !id) return null;
  return `${b64url(id)}.${sign(id, key)}`;
}

/** Returns the volunteer id when the token is authentic, else null. */
export async function verifyVolunteerToken(token: string): Promise<string | null> {
  const key = await secret();
  if (!key || !token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  let id: string;
  try {
    id = unb64url(token.slice(0, dot));
  } catch {
    return null;
  }
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(id, key));
  if (provided.length !== expected.length) return null;
  return crypto.timingSafeEqual(provided, expected) ? id : null;
}
