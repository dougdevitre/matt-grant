import "server-only";
import { getVolunteers, type VolunteerRow } from "@/lib/queries";

// A captain's own team: the volunteers claimed onto them (captainEmail === the
// captain's email). Mirrors the client-side "My team" facet
// (lib/table/volunteers-config.ts) and the server-side teamByCaptain grouping in
// lib/volunteers/score-data.ts, but as a single reusable reader for the extension's
// captain-scoped /api/ext/team endpoint.
//
// SECURITY: pass the AUTHENTICATED caller's email (gate.email). This returns only
// rows whose captainEmail matches — a captain can never read another captain's team.
// There's no DynamoDB index on captainEmail, so this filters the full roster read
// (getVolunteers) in code, the same as every other by-captain view in the app.

const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export async function getCaptainTeam(captainEmail: string | null | undefined): Promise<VolunteerRow[]> {
  const me = lc(captainEmail);
  if (!me) return [];
  const { rows } = await getVolunteers();
  return rows.filter((v) => lc(v.captainEmail) === me);
}
