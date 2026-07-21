// The Profile Optimizer engine. Pure functions (no I/O) so they unit-test cleanly
// and run identically in a server action or a future cron. Two jobs:
//   1. scoreContent()  — grade a draft against a channel's schema before it ships
//      (length fit, hook, hashtags, CTA, link, and the FEC "paid for by" line).
//   2. analyzeProfile() / footprintScore() — turn the engagement numbers an admin
//      enters per channel into an awareness + conversion read and a single
//      "digital footprint" dominance index, with prioritized, plain-English moves.
//
// No fabricated benchmarks: thresholds below are industry rules-of-thumb, labeled
// as such, not claims about Matt's actual numbers.

import { CHANNELS, composeText, type ChannelId } from "@/lib/social/channels";
import { CAMPAIGN } from "@/lib/site";

// ── Content scoring ──────────────────────────────────────────────────────────

export type ContentInput = {
  channel: ChannelId;
  caption: string;
  hashtags: string[];
  hasMedia: boolean;
  link?: string;
  cta?: string;
  /** Whether the FEC "Paid for by …" line is present (on the image or in copy). */
  hasDisclaimer: boolean;
};

export type Severity = "error" | "warn" | "tip";
export type ContentIssue = { severity: Severity; message: string };
export type ContentScore = {
  channel: ChannelId;
  chars: number;
  maxChars: number;
  overBy: number; // >0 means it will be rejected/truncated on-platform
  hashtagCount: number;
  score: number; // 0–100
  issues: ContentIssue[];
};

const CTA_HINTS = ["donate", "volunteer", "vote", "join", "sign", "share", "learn", "rsvp", "chip in", "text", "call"];

export function scoreContent(input: ContentInput): ContentScore {
  const spec = CHANNELS[input.channel];
  const text = composeText(input.caption, input.hashtags);
  const chars = text.length;
  const overBy = Math.max(0, chars - spec.maxChars);
  const hashtagCount = input.hashtags.length;
  const issues: ContentIssue[] = [];
  let score = 100;

  if (overBy > 0) {
    issues.push({ severity: "error", message: `${overBy} characters over the ${spec.label} limit (${spec.maxChars}). It will be rejected or cut.` });
    score -= 40;
  } else if (chars > spec.feedTruncateChars && spec.feedTruncateChars < spec.maxChars) {
    issues.push({ severity: "tip", message: `Only the first ~${spec.feedTruncateChars} characters show before "…more" — front-load the hook.` });
    score -= 6;
  }
  if (input.caption.trim().length === 0) {
    issues.push({ severity: "error", message: "Caption is empty." });
    score -= 40;
  }

  const [hMin, hMax] = spec.recommendedHashtags;
  if (spec.maxHashtags > 0 && hashtagCount > spec.maxHashtags) {
    issues.push({ severity: "error", message: `${hashtagCount} hashtags exceeds ${spec.label}'s max of ${spec.maxHashtags}.` });
    score -= 20;
  } else if (hashtagCount > hMax) {
    issues.push({ severity: "warn", message: `${hashtagCount} hashtags is above the recommended ${hMin}–${hMax} for ${spec.label} — fewer, sharper tags perform better.` });
    score -= 8;
  } else if (hashtagCount < hMin) {
    issues.push({ severity: "tip", message: `Add ${hMin - hashtagCount} more relevant hashtag(s) (recommended ${hMin}–${hMax}).` });
    score -= 4;
  }

  if (!input.hasMedia) {
    issues.push({ severity: "warn", message: "No image attached — posts with media earn meaningfully more reach. Generate one in the studio." });
    score -= 12;
  }

  const lower = `${input.caption} ${input.cta ?? ""}`.toLowerCase();
  const hasCta = !!input.cta || CTA_HINTS.some((c) => lower.includes(c));
  if (!hasCta) {
    issues.push({ severity: "warn", message: "No clear call to action — tell people the one thing to do (Donate, Volunteer, Vote, Share)." });
    score -= 10;
  }

  if (!input.hasDisclaimer) {
    // The composer's renderer always appends "Paid for by …" to the post TEXT, so
    // a text post is compliant by construction; nudge to also bake it into the
    // graphic for image-first surfaces (Instagram, Stories) where text is skimmed.
    issues.push({ severity: "tip", message: `The "${CAMPAIGN.paidForBy}" line is auto-added to the post text — also put it on the graphic for image-first channels.` });
    score -= 4;
  }

  if (input.link && input.channel === "instagram") {
    issues.push({ severity: "tip", message: "Links aren't clickable in Instagram captions — drive to the link in bio instead." });
  }

  return {
    channel: input.channel,
    chars,
    maxChars: spec.maxChars,
    overBy,
    hashtagCount,
    score: Math.max(0, Math.min(100, Math.round(score))),
    issues,
  };
}

// ── Profile / engagement analysis ──────────────────────────────────────────────

export type ChannelMetrics = {
  channel: ChannelId;
  followers: number;
  posts30d: number;
  impressions30d: number; // a.k.a. reach/views
  engagements30d: number; // likes + comments + shares + saves
  profileVisits30d: number;
  linkClicks30d: number;
  conversions30d: number; // donations, signups, RSVPs attributed to the channel
};

export type ChannelInsight = {
  channel: ChannelId;
  /** engagements / impressions, as a %. */
  engagementRate: number;
  /** impressions / followers — how far each post travels beyond the base (awareness). */
  amplification: number;
  /** posts per week. */
  cadencePerWeek: number;
  /** linkClicks / profileVisits, as a % (interest → action). */
  clickThrough: number;
  /** conversions / linkClicks, as a % (the conversion step). */
  conversionRate: number;
  /** 0–100 health for this channel. */
  health: number;
  recommendations: Recommendation[];
};

export type Recommendation = {
  priority: "high" | "medium" | "low";
  lever: "awareness" | "conversion" | "consistency" | "engagement";
  message: string;
};

// Rules-of-thumb thresholds (industry guidance, not Matt-specific data).
const TARGET_ENG_RATE = 2.0; // % — a healthy organic engagement rate
const TARGET_AMPLIFICATION = 1.0; // reaching beyond your own followers
const TARGET_CADENCE = 5; // posts/week — daily-ish presence
const TARGET_CTR = 5.0; // % of profile visitors who click the link
const TARGET_CONV = 3.0; // % of link-clickers who convert

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

export function analyzeChannel(m: ChannelMetrics): ChannelInsight {
  const engagementRate = pct(m.engagements30d, m.impressions30d);
  const amplification = m.followers > 0 ? m.impressions30d / Math.max(1, m.posts30d) / m.followers : 0;
  const cadencePerWeek = (m.posts30d / 30) * 7;
  const clickThrough = pct(m.linkClicks30d, m.profileVisits30d);
  const conversionRate = pct(m.conversions30d, m.linkClicks30d);

  const recs: Recommendation[] = [];
  if (cadencePerWeek < TARGET_CADENCE) {
    recs.push({ priority: "high", lever: "consistency", message: `Posting ~${cadencePerWeek.toFixed(1)}×/week — push toward ${TARGET_CADENCE}. The countdown calendar already has daily slots; fill them.` });
  }
  if (engagementRate < TARGET_ENG_RATE) {
    recs.push({ priority: "high", lever: "engagement", message: `Engagement rate ${engagementRate.toFixed(1)}% is below the ~${TARGET_ENG_RATE}% rule of thumb — lead with questions, faces, and short video; reply in the first hour.` });
  }
  if (amplification < TARGET_AMPLIFICATION) {
    recs.push({ priority: "medium", lever: "awareness", message: `Each post reaches under 1× your follower base — use trending/issue hashtags, tag local coalitions, and reshare top posts to Stories to break out of the bubble.` });
  }
  if (clickThrough < TARGET_CTR && m.profileVisits30d > 0) {
    recs.push({ priority: "medium", lever: "conversion", message: `Only ${clickThrough.toFixed(1)}% of profile visitors click through — tighten the bio link and add one clear CTA per post.` });
  }
  if (conversionRate < TARGET_CONV && m.linkClicks30d > 0) {
    recs.push({ priority: "high", lever: "conversion", message: `${conversionRate.toFixed(1)}% of clicks convert — make the landing page match the post (donate posts → WinRed, volunteer posts → /act), and cut form friction.` });
  }

  // Health blends the five signals against their targets, capped at 100.
  const ratio = (val: number, target: number) => Math.min(1, target > 0 ? val / target : 0);
  const health = Math.round(
    100 *
      (0.25 * ratio(engagementRate, TARGET_ENG_RATE) +
        0.2 * ratio(amplification, TARGET_AMPLIFICATION) +
        0.2 * ratio(cadencePerWeek, TARGET_CADENCE) +
        0.15 * ratio(clickThrough, TARGET_CTR) +
        0.2 * ratio(conversionRate, TARGET_CONV)),
  );

  return { channel: m.channel, engagementRate, amplification, cadencePerWeek, clickThrough, conversionRate, health, recommendations: recs };
}

export type FootprintReport = {
  /** 0–100 dominance index across the channels with data. */
  index: number;
  totalFollowers: number;
  totalImpressions30d: number;
  totalConversions30d: number;
  channels: ChannelInsight[];
  /** Channels in CHANNELS with no metrics yet — presence gaps to close. */
  missingChannels: ChannelId[];
  /** The highest-priority moves across all channels, de-duplicated and ranked. */
  topMoves: Recommendation[];
};

export function footprintScore(metrics: ChannelMetrics[]): FootprintReport {
  const channels = metrics.map(analyzeChannel);
  const present = new Set(metrics.map((m) => m.channel));
  const missingChannels = (Object.keys(CHANNELS) as ChannelId[]).filter((c) => !present.has(c));

  // Coverage: how many of the major channels are active (presence breadth).
  const coverage = present.size / Object.keys(CHANNELS).length;
  const avgHealth = channels.length ? channels.reduce((s, c) => s + c.health, 0) / channels.length : 0;
  // Dominance = 60% how well the active channels perform + 40% how broadly you show up.
  const index = Math.round(0.6 * avgHealth + 0.4 * coverage * 100);

  const order = { high: 0, medium: 1, low: 2 } as const;
  const topMoves = channels
    .flatMap((c) => c.recommendations.map((r) => ({ ...r, message: `${CHANNELS[c.channel].label}: ${r.message}` })))
    .sort((a, b) => order[a.priority] - order[b.priority])
    .slice(0, 6);

  return {
    index,
    totalFollowers: metrics.reduce((s, m) => s + m.followers, 0),
    totalImpressions30d: metrics.reduce((s, m) => s + m.impressions30d, 0),
    totalConversions30d: metrics.reduce((s, m) => s + m.conversions30d, 0),
    channels,
    missingChannels,
    topMoves,
  };
}
