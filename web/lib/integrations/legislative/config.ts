// Env-based config (Vercel/Next — no SSM). Get a free key at https://api.congress.gov/sign-up/.
// Default target = Ann Wagner (MO-02), bioguide W000812 — VERIFY via
// /member?currentMember=true&stateCode=MO before relying on it for production.

export type LegConfig = {
  apiKey: string;
  bioguideId: string;
  voteYear: number;
  fromRoll: number;
  toRoll: number;
};

export function loadConfig(): LegConfig {
  return {
    apiKey: process.env.CONGRESS_GOV_API_KEY ?? "",
    bioguideId: process.env.RESEARCH_BIOGUIDE_ID ?? "W000812",
    voteYear: Number(process.env.RESEARCH_VOTE_YEAR ?? "2025"),
    fromRoll: Number(process.env.RESEARCH_FROM_ROLL ?? "1"),
    toRoll: Number(process.env.RESEARCH_TO_ROLL ?? "60"),
  };
}

export const congressEnabled = !!process.env.CONGRESS_GOV_API_KEY;
