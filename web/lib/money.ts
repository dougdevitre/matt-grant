// FEC individual-to-candidate limit for the 2025–2026 cycle is $3,500 PER
// ELECTION (primary and general counted separately). Verify against current
// FEC guidance before relying on it — limits are indexed each cycle.
// Verified on 2026-06-18 at fec.gov ("increased to $3,500 per election, per
// candidate"): fec.gov/updates/contribution-limits-for-2025-2026/
// Re-verify each cycle (next indexing applies to the 2027–2028 cycle).
export const FEC_INDIVIDUAL_PER_ELECTION_CENTS = 350000;

export function dollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function dollarsExact(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
