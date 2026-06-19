// Normalized FEC summary for a candidate. Source: OpenFEC (api.open.fec.gov/v1).
// Public campaign-finance data; every figure links back to fec.gov.

export type FecSummary = {
  fecCandidateId: string;
  name?: string | null;
  party?: string | null;
  office?: string | null;
  cycle: number;
  totals: {
    receipts: number | null; // total raised
    disbursements: number | null; // total spent
    cashOnHand: number | null; // cash on hand end of period
    individualContributions: number | null;
    pacContributions: number | null;
  };
  principalCommittee?: string | null;
  sourceUrl: string; // fec.gov candidate page
  retrievedAt: string;
};
