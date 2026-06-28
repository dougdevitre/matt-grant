// Client-safe option lists for the influencer outreach-pipeline editor. Kept in its OWN module
// (no server-only imports) so the client <InfluencerTable> can import these values without
// pulling the server-only Airtable client into the browser bundle. Mirrors the singleSelect
// choices in the Master Database "Influential Voters" schema — keep in sync if they change there.

export const INFLUENCER_EDIT = {
  stage: {
    field: "Outreach Stage",
    label: "Outreach Stage",
    options: [
      "Not Started", "Researched", "Warm Intro", "Meeting Requested", "Meeting Held",
      "Ask Made", "Activated", "Surrogate Deployed", "Maintain / Hold",
    ],
  },
  outcome: {
    field: "Outcome",
    label: "Outcome",
    options: ["Pending", "Endorsed", "Supportive", "Neutral", "Declined", "No Response"],
  },
  alignment: {
    field: "Alignment",
    label: "Alignment",
    options: ["Ally", "Leans For", "Neutral / Unknown", "Leans Against", "Opposed"],
  },
} as const;
