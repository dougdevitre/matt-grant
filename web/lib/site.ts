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
  { href: "/about", label: "About Matt / Issues" },
  { href: "/donate", label: "Donate" },
  { href: "/press", label: "Press" },
  { href: "/contact", label: "Contact" },
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
