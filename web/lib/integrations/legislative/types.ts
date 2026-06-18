// Normalized shapes for the opponent's public legislative record.
// Sources: Congress.gov API (member, bills) + House Clerk roll-call XML (votes).

export type LegMember = {
  bioguideId: string;
  name: string;
  party?: string | null;
  state?: string | null;
  district?: string | null;
  profile?: unknown;
};

export type LegVoteRec = {
  year: number;
  rollNumber: number;
  position?: string | null; // Yea / Nay / Present / Not Voting
  question?: string | null;
  result?: string | null;
  legisNum?: string | null;
  voteDate?: string | null;
  sourceUrl: string;
};

export type LegBillRec = {
  relation: "sponsored" | "cosponsored";
  congress: number;
  billType: string;
  number: string;
  title?: string | null;
  policyArea?: string | null;
  introducedDate?: string | null;
  sourceUrl: string;
};

export type NormalizedDataset = {
  generatedAt: string;
  bioguideId: string;
  member: LegMember;
  sponsored: LegBillRec[];
  cosponsored: LegBillRec[];
  votes: LegVoteRec[];
  counts: { sponsored: number; cosponsored: number; votes: number };
};
