// SMS audience enrichment core (candidate/sms-targeting-plan.md §2, Phase 1;
// extended with geography per candidate/sms-conversational-interface-plan.md §5).
//
// Pure merge logic for the out-of-band enrichment job
// (scripts/enrich-sms-audience.ts): given the opted-in ledger, voters matched to
// campaign contacts by name+ZIP (lib/voters/phones.ts), the banked set from
// ballot returns, and named contacts with a ZIP, produce the denormalized tags
// to write onto SMSCONSENT rows — voterSegment / voterT / banked / county / zip.
//
// This module lives in lib/reports/ (like smsTargeting.ts) because it references
// voter types. Nothing under lib/sms/ imports it — the composer reads only the
// plain fields the job wrote onto consent rows, so the send path never touches a
// voter partition (the TCPA wall, audiences.voterfile-isolation.test.ts).
//
// Precedence rules:
//   • A voter-file match is authoritative for segment/T/banked, and for geography
//     UNLESS the person self-reported their county to the SMS vote agent
//     (geoSource "self", lib/sms/votebot.ts) — their own answer is fresher.
//   • A contact-only ZIP (volunteer/donor roster, no voter match) fills geography
//     when nothing better exists; county only when the ZIP is in the verified
//     starter map (lib/sms/geo.ts) — never guessed.
import type { Segment } from "@/lib/voters/score";

export type MatchedVoterTag = {
  phone: string; // E.164, already confirmed opted-in by the caller's data load
  segment: Segment;
  t: number;
  county: string; // raw voter-file county name (normalized via countyKeyForName)
  zip: string;
  banked: boolean;
};

export type ContactTag = { phone: string; zip?: string | null };

export type GeoSource = "self" | "voterfile" | "contact";

export type EnrichmentWrite = {
  phone: string;
  voterSegment?: Segment;
  voterT?: number;
  banked?: boolean;
  county?: string; // CountyKey (lib/sms/geo.ts)
  zip?: string;
  schoolDistrict?: string; // LEAID (lib/sms/school-districts.ts), unambiguous ZIPs only
  geoSource?: Exclude<GeoSource, "self">; // "self" is only ever written by the vote agent
};

export type EnrichmentPlan = {
  writes: EnrichmentWrite[];
  skippedNotOptedIn: number; // candidates dropped because the number has no opt-in
  geoPreserved: number; // rows whose self-reported geography was left untouched
};

const zip5 = (s: string | null | undefined): string | null => {
  const z = (s ?? "").trim().slice(0, 5);
  return /^\d{5}$/.test(z) ? z : null;
};

export function buildEnrichmentPlan(input: {
  optedIn: Set<string>;
  matched: MatchedVoterTag[];
  contacts: ContactTag[];
  /** phone → current geoSource on the consent row ("self" is preserved). */
  existingGeoSource: Map<string, string>;
  /** phone → ZIP already on the consent row (incl. self-reported) — lets a row
   *  that contributes no new geo still gain a school district. */
  existingZips?: Map<string, string>;
  countyKeyForName: (raw: string) => string | null;
  countyKeyForZip: (z: string) => string | null;
  /** ZIP → district LEAID, UNAMBIGUOUS matches only (districtForZipUnambiguous). */
  districtForZip?: (z: string) => string | null;
}): EnrichmentPlan {
  const { optedIn, existingGeoSource, countyKeyForName, countyKeyForZip } = input;
  const existingZips = input.existingZips ?? new Map<string, string>();
  const districtForZip = input.districtForZip ?? (() => null);
  const byPhone = new Map<string, EnrichmentWrite>();
  let skippedNotOptedIn = 0;
  let geoPreserved = 0;

  const selfReported = (phone: string) => existingGeoSource.get(phone) === "self";

  // Voter-file matches first — authoritative, and they claim the phone so a
  // contact-only row can't downgrade them.
  for (const m of input.matched) {
    if (!optedIn.has(m.phone)) {
      skippedNotOptedIn++;
      continue;
    }
    const w: EnrichmentWrite = { phone: m.phone, voterSegment: m.segment, voterT: m.t, banked: m.banked };
    if (selfReported(m.phone)) {
      geoPreserved++;
    } else {
      const county = countyKeyForName(m.county);
      const z = zip5(m.zip);
      if (county) w.county = county;
      if (z) w.zip = z;
      if (county || z) w.geoSource = "voterfile";
    }
    byPhone.set(m.phone, w);
  }

  // Contact-only geography (volunteer/donor roster ZIP, no voter match).
  for (const c of input.contacts) {
    if (byPhone.has(c.phone)) continue; // voter-file tag already claimed it
    if (!optedIn.has(c.phone)) {
      skippedNotOptedIn++;
      continue;
    }
    const z = zip5(c.zip);
    if (!z) continue; // nothing to contribute
    if (selfReported(c.phone)) {
      geoPreserved++;
      continue;
    }
    const county = countyKeyForZip(z);
    byPhone.set(c.phone, { phone: c.phone, zip: z, ...(county ? { county } : {}), geoSource: "contact" });
  }

  // School district — a DERIVED attribute from whichever ZIP the row ends up
  // with (this run's, or one already stored, incl. self-reported). Only an
  // UNAMBIGUOUS crosswalk match is written; multi-district ZIPs stay untagged.
  for (const w of byPhone.values()) {
    const z = w.zip ?? existingZips.get(w.phone);
    const district = z ? districtForZip(z) : null;
    if (district) w.schoolDistrict = district;
  }
  for (const [phone, z] of existingZips) {
    if (byPhone.has(phone) || !optedIn.has(phone)) continue;
    const district = districtForZip(z);
    if (district) byPhone.set(phone, { phone, schoolDistrict: district });
  }

  return { writes: [...byPhone.values()], skippedNotOptedIn, geoPreserved };
}
