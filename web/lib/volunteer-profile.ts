// Structured volunteer profile vocabulary — shared by the dashboard capture form
// and the matching engine so the option strings stay in sync.
export const VOLUNTEER_MODES = ["Digital", "In-person", "Either"] as const;

export const VOLUNTEER_AVAILABILITY = [
  "Weekday daytime",
  "Weekday evening",
  "Weekend",
  "Election Day",
] as const;

export const VOLUNTEER_SKILLS = [
  "Driving",
  "Writing",
  "Design",
  "Public speaking",
  "Bilingual",
  "Tech",
  "Hospitality",
  "Data entry",
] as const;
