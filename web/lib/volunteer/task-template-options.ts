// Client-safe option lists for the task-template editor. Own module (no server-only imports) so
// the client editor can use these without pulling the server-only Airtable client into the browser
// bundle. Mirrors the singleSelect choices in the Volunteer base's "Task Templates" schema — keep
// in sync if they change there.

export const TT_STATUS = ["Draft", "Active", "Archived"] as const;
export const TT_PRIORITY = ["High", "Medium", "Low"] as const;
export const TT_MODE = ["Digital", "In-person", "Either"] as const;
export const TT_GEO = [
  "District-wide", "County", "School District", "Precinct", "Neighborhood", "City/Town", "Remote",
] as const;
export const TT_EFFORT = ["15 min", "1 hour", "2-4 hr shift", "Half-day", "Ongoing"] as const;
export const TT_PHASE = ["Build", "Persuasion", "GOTV", "Election Day", "All phases"] as const;
export const TT_PASS = [
  "Voter ID", "Persuasion", "GOTV", "Literature drop", "Re-knock / Not-home",
  "N/A (not a canvass)", "Ballot chase", "Donor thank-you",
] as const;
