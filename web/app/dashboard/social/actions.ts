"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { createPost, cancelPost, confirmChannelPosted, drainDue } from "@/lib/social/schedule";
import { toChannelIds, isChannelId, type ChannelId } from "@/lib/social/channels";
import { footprintScore, type ChannelMetrics, type FootprintReport } from "@/lib/social/optimize";
import { recordSnapshot } from "@/lib/social/footprint";
import { verifyChannel, type ChannelStatus } from "@/lib/social/publish";
import { CHANNEL_IDS } from "@/lib/social/channels";
import { planSlots } from "@/lib/social/scheduler";
import { SOCIAL_POSTS } from "@/lib/socialPosts";

export type ActionState = { ok: boolean; message: string };

function parseHashtags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim().replace(/^#+/, ""))
    .filter(Boolean)
    .map((t) => `#${t}`);
}

// Schedule (or save as a draft / post now). Admins only.
export async function schedulePost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await staffGate();
  if (!can(g.role, "manageSocial")) return { ok: false, message: "Only admins can use the command center." };

  const caption = String(formData.get("caption") ?? "").trim();
  if (!caption) return { ok: false, message: "Write a caption first." };

  const channels = toChannelIds(formData.getAll("channels").map(String));
  if (channels.length === 0) return { ok: false, message: "Pick at least one channel." };

  const hashtags = parseHashtags(String(formData.get("hashtags") ?? ""));
  const link = String(formData.get("link") ?? "").trim() || undefined;
  const mediaUrl = String(formData.get("mediaUrl") ?? "").trim() || undefined;
  const videoUrl = String(formData.get("videoUrl") ?? "").trim() || undefined;
  const mediaKey = String(formData.get("mediaKey") ?? "").trim() || undefined;
  const pillar = String(formData.get("pillar") ?? "").trim() || undefined;
  const cta = String(formData.get("cta") ?? "").trim() || undefined;

  const rawWhen = String(formData.get("scheduledAt") ?? "").trim();
  const mode = String(formData.get("mode") ?? "schedule"); // schedule | now | draft
  let scheduledAt: string | undefined;
  if (mode === "now") {
    scheduledAt = new Date().toISOString();
  } else if (mode === "schedule" && rawWhen) {
    const d = new Date(rawWhen);
    if (isNaN(d.getTime())) return { ok: false, message: "That schedule time isn't valid." };
    scheduledAt = d.toISOString();
  } else if (mode === "schedule" && !rawWhen) {
    return { ok: false, message: "Pick a date and time, or choose Post now / Save draft." };
  }

  await createPost({ caption, hashtags, channels, link, mediaUrl, videoUrl, mediaKey, pillar, cta, scheduledAt, createdBy: g.email ?? "system" });

  // Post-now: publish the due item inline so it goes out immediately; the cron
  // worker would otherwise pick it up within a minute.
  if (mode === "now") {
    try {
      await drainDue();
    } catch {
      /* cron worker will retry */
    }
  }
  revalidatePath("/dashboard/social");
  return {
    ok: true,
    message:
      mode === "now"
        ? `Publishing to ${channels.length} channel(s) now — API channels post automatically, manual channels are staged below to copy & post.`
        : mode === "draft"
          ? "Saved as a draft."
          : `Scheduled for ${rawWhen.replace("T", " ")} across ${channels.length} channel(s).`,
  };
}

export async function cancelPostAction(formData: FormData): Promise<void> {
  const g = await staffGate();
  if (!can(g.role, "manageSocial")) return;
  const id = String(formData.get("id") ?? "");
  if (id) await cancelPost(id);
  revalidatePath("/dashboard/social");
}

export async function confirmPostedAction(formData: FormData): Promise<void> {
  const g = await staffGate();
  if (!can(g.role, "manageSocial")) return;
  const id = String(formData.get("id") ?? "");
  const channel = String(formData.get("channel") ?? "");
  if (id && isChannelId(channel)) await confirmChannelPosted(id, channel as ChannelId);
  revalidatePath("/dashboard/social");
}

// Pull per-channel metrics out of the optimizer form. Shared by the analyze and
// save-snapshot actions so they read the form identically.
function parseMetrics(formData: FormData): ChannelMetrics[] {
  const num = (ch: string, field: string) => Math.max(0, Number(formData.get(`${ch}_${field}`) ?? 0) || 0);
  const metrics: ChannelMetrics[] = [];
  for (const ch of formData.getAll("metricChannel").map(String)) {
    if (!isChannelId(ch)) continue;
    const followers = num(ch, "followers");
    const posts30d = num(ch, "posts30d");
    // Skip channels left entirely blank so the footprint reflects real presence.
    if (followers === 0 && posts30d === 0 && num(ch, "impressions30d") === 0) continue;
    metrics.push({
      channel: ch as ChannelId,
      followers,
      posts30d,
      impressions30d: num(ch, "impressions30d"),
      engagements30d: num(ch, "engagements30d"),
      profileVisits30d: num(ch, "profileVisits30d"),
      linkClicks30d: num(ch, "linkClicks30d"),
      conversions30d: num(ch, "conversions30d"),
    });
  }
  return metrics;
}

// Profile Optimizer — analyze the per-channel metrics an admin enters and return
// the awareness/conversion read + footprint index. No write; pure compute.
export async function analyzeProfileAction(_prev: { report: FootprintReport | null; message: string }, formData: FormData): Promise<{ report: FootprintReport | null; message: string }> {
  const g = await staffGate();
  if (!can(g.role, "manageSocial")) return { report: null, message: "Only admins can use the optimizer." };
  const metrics = parseMetrics(formData);
  if (metrics.length === 0) return { report: null, message: "Enter metrics for at least one channel." };
  return { report: footprintScore(metrics), message: "" };
}

// Save the current analysis to the footprint history so the index trend is
// tracked over time. Void action used as a form button's formAction.
export async function saveFootprintSnapshot(formData: FormData): Promise<void> {
  const g = await staffGate();
  if (!can(g.role, "manageSocial")) return;
  const metrics = parseMetrics(formData);
  if (metrics.length === 0) return;
  await recordSnapshot(footprintScore(metrics), g.email ?? "system");
  revalidatePath("/dashboard/social");
}

// Auto-schedule: drop the next N posts from the content calendar onto each
// selected channel's best-time slots over the coming days. Admins only.
export async function fillWeekAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await staffGate();
  if (!can(g.role, "manageSocial")) return { ok: false, message: "Only admins can use the command center." };

  const channels = toChannelIds(formData.getAll("channels").map(String));
  if (channels.length === 0) return { ok: false, message: "Pick at least one channel." };
  const count = Math.min(21, Math.max(1, Number(formData.get("count") ?? 7) || 7));

  // Take the next `count` posts from the countdown calendar (highest day first —
  // i.e. furthest from Election Day, the natural posting order).
  const library = [...SOCIAL_POSTS].sort((a, b) => b.day - a.day).slice(0, count);
  const slots = planSlots(channels, library.length, new Date().toISOString());
  if (slots.length === 0) return { ok: false, message: "No future slots available — try more channels or a longer window." };

  let scheduled = 0;
  for (let i = 0; i < Math.min(slots.length, library.length); i++) {
    const p = library[i];
    await createPost({
      caption: p.caption,
      hashtags: p.hashtags,
      channels: toChannelIds(p.channels).filter((c) => channels.includes(c)).length ? toChannelIds(p.channels).filter((c) => channels.includes(c)) : channels,
      pillar: p.pillar,
      cta: p.cta,
      scheduledAt: slots[i],
      createdBy: g.email ?? "system",
    });
    scheduled++;
  }
  revalidatePath("/dashboard/social");
  const first = new Date(slots[0]).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return { ok: true, message: `Scheduled ${scheduled} posts at best-time slots, starting ${first}. Review them in the calendar below.` };
}

// Verify each channel's credentials without posting — read-only Graph/X calls so
// the admin can confirm what's wired before a real publish.
export async function testConnectionsAction(_prev: { statuses: ChannelStatus[] }): Promise<{ statuses: ChannelStatus[] }> {
  const g = await staffGate();
  if (!can(g.role, "manageSocial")) return { statuses: [] };
  const statuses = await Promise.all(CHANNEL_IDS.map((c) => verifyChannel(c)));
  return { statuses };
}
