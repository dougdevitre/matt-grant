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

// Donor profile derived from OpenFEC Schedule A aggregates — the OpenSecrets
// replacement (OpenSecrets discontinued its API 2025-04-15). All from public
// itemized-receipt data; describes the money, never the donor personally.
export type DonorBucket = { label: string; amount: number };

export type DonorProfile = {
  fecCandidateId: string;
  committeeId: string | null;
  cycle: number;
  topEmployers: DonorBucket[]; // by contributor employer
  topOccupations: DonorBucket[]; // by contributor occupation
  bySize: DonorBucket[]; // small-dollar vs large-dollar mix
  byState: DonorBucket[]; // in-district/in-state vs out-of-state money
  sourceUrl: string;
  retrievedAt: string;
};

// Per-cycle fundraising + outside money — feeds the tenure timeline.
export type CycleFinance = {
  cycle: number;
  receipts: number | null;
  disbursements: number | null;
  cashOnHand: number | null;
  ieSupport: number | null; // independent expenditures FOR (Schedule E)
  ieOppose: number | null; // independent expenditures AGAINST
  sourceUrl: string;
};
