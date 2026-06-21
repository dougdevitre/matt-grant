import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

// Runtime secret loader — the foundation for getting secrets OUT of the build
// artifact (amplify.yml currently bakes decrypted SSM values into .env.production,
// which lands in the .next artifact + build cache).
//
// ENV-FIRST, by design: if the variable is already in process.env, that value is
// used and SSM is never touched. So adopting getSecret() is a NO-OP while the
// current bake-at-build flow is in place — there is no behavior change and no risk
// to the running app. Only once you stop baking a secret (and the env var is
// absent) does this fetch it from /matt-grant/<NAME> at runtime, via the SSR
// Lambda's IAM role, and cache it for the life of the warm container.
//
// Missing parameter / no access → undefined, so the app degrades exactly like it
// does today when a secret is unset. Wiring call sites + flipping amplify.yml +
// rotation is a separate, reviewed step (see infra/SECRETS-MIGRATION.md).
//
// CACHE TTL: a fetched value is cached for SSM_SECRET_TTL_MS (default 5 min), not
// for the whole container lifetime. This means a ROTATION in SSM is picked up
// within the TTL with no redeploy — without a TTL, warm Lambdas held the old
// value indefinitely and a new bearer/key would 401 until the container cycled.
// The TTL trades a bounded staleness window for self-healing rotation; the per-
// container SSM call rate stays ~1 per secret per TTL (negligible).

const PREFIX = process.env.SSM_PARAM_PREFIX ?? "/matt-grant";
const TTL_MS = Number(process.env.SSM_SECRET_TTL_MS) || 5 * 60_000;
type Entry = { value: string | undefined; expires: number };
const cache = new Map<string, Entry>();
let client: SSMClient | null = null;
const ssm = () => (client ??= new SSMClient({ region: process.env.AWS_REGION ?? "us-east-1" }));

export async function getSecret(name: string): Promise<string | undefined> {
  const fromEnv = process.env[name];
  if (fromEnv) return fromEnv; // env always wins — no-op until secrets stop being baked

  const hit = cache.get(name);
  if (hit && hit.expires > Date.now()) return hit.value; // fresh within TTL

  let value: string | undefined;
  try {
    const out = await ssm().send(new GetParameterCommand({ Name: `${PREFIX}/${name}`, WithDecryption: true }));
    value = out.Parameter?.Value || undefined;
  } catch {
    value = undefined; // not found / unauthorized — degrade like an unset secret
  }
  cache.set(name, { value, expires: Date.now() + TTL_MS });
  return value;
}

// Test seam — clears the in-memory cache so a test can change the fixture.
export function _clearSecretCache(): void {
  cache.clear();
}
