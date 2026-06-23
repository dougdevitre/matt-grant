import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

// Reads the OAuth *app* credentials the campaign loaded into Parameter Store under
//   /mattgrant/prod/social/<platform>/<field>
// (client_id, client_secret, app_id, app_secret, redirect_uri, …). These are the
// inputs to the OAuth connect flow; the per-account access tokens it produces are
// stored separately (lib/social/connections.ts), not here.
//
// ENV-FIRST for tests/overrides: SOCIAL_<PLATFORM>_<FIELD> (upper-cased) wins over
// SSM, mirroring lib/ssm.ts. Missing/!configured → undefined, so the app degrades
// exactly like an unconnected channel.

const PREFIX = process.env.SOCIAL_PARAM_PREFIX ?? "/mattgrant/prod/social";
const TTL_MS = Number(process.env.SSM_SECRET_TTL_MS) || 5 * 60_000;

// Shared Meta Graph version for OAuth + publishing (override as Meta deprecates).
export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
export const META_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

type Entry = { value: string | undefined; expires: number };
const cache = new Map<string, Entry>();
let client: SSMClient | null = null;
const ssm = () => (client ??= new SSMClient({ region: process.env.AWS_REGION ?? "us-east-1" }));

export type SocialPlatform = "x" | "facebook" | "instagram" | "linkedin" | "tiktok" | "youtube";

/** Read one app-credential field for a platform (env override → SSM → undefined). */
export async function socialAppParam(platform: SocialPlatform, field: string): Promise<string | undefined> {
  const envName = `SOCIAL_${platform}_${field}`.toUpperCase();
  const fromEnv = process.env[envName];
  if (fromEnv) return fromEnv;

  const key = `${platform}/${field}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  let value: string | undefined;
  try {
    const out = await ssm().send(new GetParameterCommand({ Name: `${PREFIX}/${key}`, WithDecryption: true }));
    value = out.Parameter?.Value || undefined;
  } catch {
    value = undefined;
  }
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Test seam — clears the in-memory cache. */
export function _clearAppParamCache(): void {
  cache.clear();
}
