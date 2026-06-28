// Back-compat shim. The volunteer vocabulary now lives in one canonical module,
// lib/volunteer/taxonomy.ts, which mirrors the Airtable base exactly and is shared
// by the public /join form, the matcher, and the Airtable mirror. Existing imports
// from this path keep working via the re-exports below.
//
// NOTE: VOLUNTEER_SKILLS is now an array of { name, label } (was string[]) so the
// public form can show a short label while linking on the exact Airtable name.
export {
  VOLUNTEER_MODES,
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_SKILLS,
} from "@/lib/volunteer/taxonomy";
export type { VolunteerMode, VolunteerAvailability, VolunteerSkill } from "@/lib/volunteer/taxonomy";
