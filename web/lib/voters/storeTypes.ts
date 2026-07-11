// Shared voter-store row shapes — a leaf module (no imports with side effects)
// so client components and pure libs can use the types without touching the
// server-only store.
import type { Segment } from "./score";

export type VoterAggRow = {
  precinctKey: string; // "county#precinct"
  county: string;
  count: number;
  active: number;
  t: number[]; // histogram, index 0-5
  seg: Record<Segment, number>;
  age: Record<string, number>;
  newReg: number;
  // Chase-tier universes (chase.ts) — absent on rollups written before Phase 5.
  tiers?: Record<"1" | "2" | "3" | "4", number>;
};

// The voter fields the ingest CLI writes (scripts/ingest-voters.ts).
// RSMo 115.157: political use only — the page and every export carry the notice.
export type StoredVoter = {
  voterId: string;
  firstName: string;
  lastName: string;
  address: string;
  unit?: string;
  city: string;
  zip: string;
  county: string;
  precinctName: string;
  yob: number | null;
  party?: string;
  active: boolean;
  lastVoted: { date: string; year: number; label: string } | null;
  t: number;
  s: number;
  segment: Segment;
  newRegistrant: boolean;
  // Phase 5 write-back: the 1-5 canvass ID from a returned walk sheet (s and
  // segment above are RECOMPUTED from it when present — real label beats proxy).
  canvassId?: number;
};
