import "server-only";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import type { MatchProfile } from "@/lib/volunteers/task-match";

// Self-scoped read of the signed-in user's OWN volunteer record, for task matching
// on the community hub. SECURITY: pass the AUTHENTICATED user's email (gate.email);
// this reads only `e:<their-email>` and never lists or exposes anyone else's data —
// the same self-scoping pattern as supporterTier. Returns null when they have no
// volunteer record (e.g. a pure email subscriber) or the DB is unconfigured.
export type MyVolunteerProfile = MatchProfile & { optedOut: boolean };

export async function getMyVolunteerProfile(email?: string | null): Promise<MyVolunteerProfile | null> {
  if (!dbConfigured || !email) return null;
  try {
    const r = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { PK: PK.volunteers, SK: `e:${email.trim().toLowerCase()}` } }),
    );
    const v = r.Item;
    if (!v) return null;
    return {
      roles: Array.isArray(v.roles) ? (v.roles as string[]) : [],
      skills: Array.isArray(v.skills) ? (v.skills as string[]) : [],
      commitment: typeof v.commitment === "string" ? v.commitment : null,
      mode: typeof v.mode === "string" ? v.mode : null,
      availability: Array.isArray(v.availability) ? (v.availability as string[]) : [],
      optedOut: !!v.optedOut,
    };
  } catch {
    return null;
  }
}
