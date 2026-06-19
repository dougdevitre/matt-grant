// Single source of truth for campaign facts used across the site.
// Sourced from mattgrantforcongress.org — keep faithful, do not invent.

export const CAMPAIGN = {
  candidate: "Matt Grant",
  office: "U.S. House of Representatives",
  district: "Missouri — District 2",
  districtShort: "MO-02",
  committee: "Matt Grant for Congress Committee",
  electionDate: "2026-08-04T00:00:00-05:00", // Missouri primary, Aug 4 2026
  electionLabel: "August 4, 2026",
  tagline: "A neighbor, a dad, and a problem-solver.",
  promise: "Putting Missouri's children first.",
  email: "mattgrantforcongress@gmail.com",
  phone: "(314) 255-7760",
  phoneHref: "tel:+13142557760",
  address: "701 Market Street, Suite 110, PMB 1709, St. Louis, MO 63101",
  donateUrl:
    "https://secure.winred.com/matt-grant-for-congress/donate-today?sc=winred-directory&money_bomb=false&recurring=false",
  paidForBy: "Paid for by the Matt Grant for Congress Committee.",
} as const;

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Matt" },
  { href: "/issues", label: "Issues" },
  { href: "/vote", label: "Vote" },
  { href: "/act", label: "Take Action" },
  { href: "/donate", label: "Donate" },
  { href: "/media", label: "Media" },
  { href: "/press", label: "Press" },
  { href: "/contact", label: "Contact" },
] as const;

export const SITE_URL = "https://mattgrantforcongress.org";

// Legal & transparency pages — linked in the footer.
export const LEGAL = [
  { href: "/data-policy", label: "Data Policy" },
  { href: "/transparency", label: "Transparency" },
  { href: "/public-trust", label: "Restoring Public Trust" },
] as const;

// Official Missouri voter lookup (registration status, polling place, sample
// ballot). Always link voters to this authoritative source rather than restating
// registration deadlines or ID rules, which change and are the county/SOS's to state.
export const VOTER_LOOKUP = "https://www.sos.mo.gov/elections/govotemissouri/lookup";

// Media booking. Set NEXT_PUBLIC_MEDIA_BOOKING_URL to a Calendly/Cal.com/Zoom
// link when one exists; until then this points at the in-app placeholder
// scheduling page (/press/schedule), which falls back to a prefilled email.
export const MEDIA = {
  bookingUrl: process.env.NEXT_PUBLIC_MEDIA_BOOKING_URL || "/press/schedule",
  email: "mattgrantforcongress@gmail.com",
} as const;

// Public CloudFront base for downloadable brand assets (objects under public/).
export const ASSETS_CDN = "https://d5jzyan9wboi3.cloudfront.net";

export const BRAND_DOWNLOADS = [
  { file: "brand/logo.png", label: "Logo (full color)" },
  { file: "brand/logo-blue.png", label: "Logo (navy)" },
  { file: "brand/logo-red.png", label: "Logo (red)" },
  { file: "brand/headshot.png", label: "Matt's headshot" },
  { file: "marketing/infographic.png", label: "The Four Fights — infographic" },
  { file: "marketing/banner-standard-of-service.png", label: "A New Standard of Service — banner" },
  { file: "marketing/grant-campaign-engine.pdf", label: "Campaign overview deck (PDF)" },
  { file: "marketing/child-protection-act-brief.pdf", label: "CHILD Protection Act — one-pager (PDF)" },
] as const;

// Print-ready PDFs (RGB + 0.125" bleed) — yard sign, palm card, mailer.
export const PRINT_DOWNLOADS = [
  { file: "print/mg-print-yardsign-24x18.pdf", label: "Yard sign — 24×18" },
  { file: "print/mg-print-palmcard-front-4x6.pdf", label: "Palm card — front (4×6)" },
  { file: "print/mg-print-palmcard-back-4x6.pdf", label: "Palm card — back (4×6)" },
  { file: "print/mg-print-mailer-front-6x9.pdf", label: "Mailer — front (6×9)" },
  { file: "print/mg-print-mailer-back-6x9.pdf", label: "Mailer — back (6×9)" },
] as const;

// His stated platform — faithful to published positions.
export const PRIORITIES = [
  {
    id: "family-courts",
    n: "01",
    title: "End corruption in the family court system",
    summary:
      "Children are too often caught in a system that protects insiders instead of kids. Matt will champion the CHILD Protection Act — Corruption Hiding Inside Legal Dockets — and push federal oversight that ties Title IV-D grant money to states that keep their family courts clean.",
    short: "Protect kids. Open the dockets. Hold courts accountable.",
  },
  {
    id: "term-limits",
    n: "02",
    title: "Term limits for the House and Senate",
    summary:
      "Public service was never meant to be a lifelong career. Matt supports term limits for both chambers — with a grandfather clause so the rules apply going forward and reform actually passes.",
    short: "Service, not careerism.",
  },
  {
    id: "smaller-government",
    n: "03",
    title: "A smaller, leaner federal government",
    summary:
      "Washington has grown faster than the results it delivers. Matt backs a federal hiring freeze and voluntary early-retirement packages to right-size the workforce without leaving families behind.",
    short: "Right-size Washington.",
  },
  {
    id: "lower-taxes",
    n: "04",
    title: "Lower taxes by cutting waste",
    summary:
      "Lower taxes start with spending less. Matt will go after fraud, waste, and bloated headcount first — so relief is funded by efficiency, not gimmicks.",
    short: "Cut waste first, then taxes.",
  },
] as const;

export const VALUES = ["Families", "Fair justice", "Honesty", "Service", "Opportunity for all"] as const;
