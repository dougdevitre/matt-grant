import { ASSETS_CDN } from "./site";

// The four issues, each a child page at /issues/<slug>. Argument and commitment
// are faithful to candidate/platform.md — no invented positions or pledges. Each
// has a dedicated video (public/video/mg-video-<slug>.mp4) and a share graphic.

export type PressLink = { outlet: string; title: string; href: string };

export type Issue = {
  slug: string;
  n: string;
  eyebrow: string;
  title: string;
  tagline: string;
  argument: string;
  commitment: string;
  // The kind of lawful, generic civic action that fits this issue — steers the
  // AI/curated action plans (e.g. observe local meetings vs. write reps). Faithful
  // to the platform; not a new policy position.
  actionAngle?: string;
  graphic: string;
  video: string;
  signature?: { name: string; body: string; briefHref: string; press?: PressLink[] };
};

const vid = (slug: string) => `${ASSETS_CDN}/public/video/mg-video-${slug}.mp4`;
const feed = (id: string) => `${ASSETS_CDN}/public/social/feed/${id}.png`;

export const ISSUES: Issue[] = [
  {
    slug: "family-courts",
    n: "01",
    eyebrow: "Children First",
    title: "End corruption in the family court system",
    tagline: "Protect kids. Open the dockets. Hold courts accountable.",
    argument:
      "Children are too often caught in a system that protects insiders instead of kids. Matt will champion the CHILD Protection Act — Corruption Hiding Inside Legal Dockets — and push federal oversight that ties Title IV-D grant money to states that keep their family courts clean.",
    commitment:
      "Champion the CHILD Protection Act and tie federal Title IV-D grant money to states that keep their family courts clean and accountable.",
    actionAngle:
      "Local + transparency-focused: encourage supporters to learn how their own family courts and school boards work, attend or observe public meetings, ask candidates and officials where they stand on court transparency and accountability, and share the CHILD Protection Act with neighbors.",
    graphic: feed("D-47"),
    video: vid("family-courts"),
    signature: {
      name: "The CHILD Protection Act of 2027",
      body:
        "CHILD stands for Corruption Hiding Inside Legal Dockets. The proposal calls for federal oversight that ties Title IV-D federal grant money to state family-court compliance — using the federal grant program as the lever for accountability. Clean, accountable courts keep the federal check; corrupt ones don't.",
      briefHref: `${ASSETS_CDN}/public/marketing/child-protection-act-brief.pdf`,
      press: [
        { outlet: "NTD News", title: "St. Louis Father Sues Missouri Family Court Insiders", href: "https://www.ntd.com/st-louis-dad-sues-missouri-family-court-insiders_1084761.html" },
        { outlet: "Legal Newsline", title: "Attorney files RICO, civil rights suit against St. Louis Family Court", href: "https://www.legalnewsline.com/stlouis-record/attorney-files-rico-civil-rights-suit-against-st-louis-family-court/article_3968fdae-167c-49f7-8221-a509f0a5a019.html" },
      ],
    },
  },
  {
    slug: "term-limits",
    n: "02",
    eyebrow: "Term Limits",
    title: "Term limits for the House and Senate",
    tagline: "Service, not careerism.",
    argument:
      "Public service was never meant to be a lifelong career. Matt supports term limits for both chambers — with a grandfather clause so the rules apply going forward and reform actually passes.",
    commitment: "Support term limits for the House and Senate, with a grandfather clause so reform actually passes.",
    actionAngle:
      "Advocacy-focused: encourage supporters to sign and circulate a term-limits pledge, write letters to the editor and to their current representatives, and ask every candidate on the ballot to commit to term limits.",
    graphic: feed("D-45"),
    video: vid("term-limits"),
  },
  {
    slug: "smaller-government",
    n: "03",
    eyebrow: "Smaller Government",
    title: "A smaller, leaner federal government",
    tagline: "Right-size Washington.",
    argument:
      "Washington has grown faster than the results it delivers. Matt backs a federal hiring freeze and voluntary early-retirement packages to right-size the workforce without leaving families behind.",
    commitment: "Back a federal hiring freeze and voluntary early-retirement packages to right-size the workforce — without leaving families behind.",
    actionAngle:
      "Accountability-focused: encourage supporters to attend public budget hearings, ask local and federal officials how they measure results for the dollars spent, and spotlight duplicative or wasteful spending in their own community.",
    graphic: feed("D-44"),
    video: vid("smaller-government"),
  },
  {
    slug: "lower-taxes",
    n: "04",
    eyebrow: "Lower Taxes",
    title: "Lower taxes by cutting waste",
    tagline: "Cut waste first, then taxes.",
    argument:
      "Lower taxes start with spending less. Matt will go after fraud, waste, and bloated headcount first — so relief is funded by efficiency, not gimmicks.",
    commitment: "Go after fraud, waste, and bloated headcount first — so tax relief is funded by efficiency, not gimmicks.",
    actionAngle:
      "Watchdog-focused: encourage supporters to track local tax and levy proposals, attend budget hearings, and ask officials to cut waste and fraud before raising taxes.",
    graphic: feed("D-43"),
    video: vid("lower-taxes"),
  },
];

export const issueSlugs = ISSUES.map((i) => i.slug);
export const getIssue = (slug: string) => ISSUES.find((i) => i.slug === slug);
