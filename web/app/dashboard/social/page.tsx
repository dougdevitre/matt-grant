import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { SocialComposer } from "@/components/dashboard/SocialComposer";
import { SocialProfileOptimizer } from "@/components/dashboard/SocialProfileOptimizer";
import { SocialConnections } from "@/components/dashboard/SocialConnections";
import { SocialAutoSchedule } from "@/components/dashboard/SocialAutoSchedule";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { requireCap } from "@/lib/auth";
import { listPosts, type ScheduledPost } from "@/lib/social/schedule";
import { CHANNELS, composeText, toChannelIds, type ChannelId } from "@/lib/social/channels";
import { cancelPostAction, confirmPostedAction } from "@/app/dashboard/social/actions";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import { SOCIAL_POSTS } from "@/lib/socialPosts";
import { channelConfigured } from "@/lib/social/publish";
import { listSnapshots } from "@/lib/social/footprint";
import { getConnection, type SocialConnection } from "@/lib/social/connections";
import type { ProviderSummary } from "@/components/dashboard/SocialConnections";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-ink/5 text-slate",
  scheduled: "bg-gold/15 text-[#9a6f1a]",
  posting: "bg-gold/15 text-[#9a6f1a]",
  posted: "bg-field/10 text-field",
  awaiting: "bg-gold/15 text-[#9a6f1a]",
  partial: "bg-gold/15 text-[#9a6f1a]",
  failed: "bg-brick/10 text-brick",
  canceled: "bg-ink/5 text-slate",
};

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export default async function SocialPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  await requireCap("manageSocial");
  const { connected, error } = await searchParams;

  const [posts, snapshots, fbConn, xConn, liConn, ttConn, ytConn] = await Promise.all([
    listPosts(),
    listSnapshots(),
    getConnection("facebook"),
    getConnection("x"),
    getConnection("linkedin"),
    getConnection("tiktok"),
    getConnection("youtube"),
  ]);
  const visible = posts.filter((p) => p.status !== "canceled");

  const daysToExpiry = (iso?: string) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / 86400000) : null);
  const providers: ProviderSummary[] = [
    {
      platform: "facebook",
      label: "Facebook + Instagram",
      connected: !!fbConn?.pageToken,
      detail: fbConn ? [fbConn.pageName && `Page ${fbConn.pageName}`, fbConn.igUsername && `@${fbConn.igUsername}`].filter(Boolean).join(" · ") || undefined : undefined,
      expiresInDays: daysToExpiry(fbConn?.expiresAt),
      pages: (fbConn?.pages ?? []).map((g: NonNullable<SocialConnection["pages"]>[number]) => ({ id: g.id, name: g.name, active: g.id === fbConn?.pageId })),
    },
    { platform: "x", label: "X (Twitter)", connected: !!xConn?.accessToken, detail: xConn?.accountName, expiresInDays: daysToExpiry(xConn?.expiresAt) },
    { platform: "linkedin", label: "LinkedIn", connected: !!liConn?.accessToken, detail: liConn?.accountName ?? liConn?.authorUrn, expiresInDays: daysToExpiry(liConn?.expiresAt) },
    { platform: "tiktok", label: "TikTok", connected: !!ttConn?.accessToken, detail: ttConn?.accountName, expiresInDays: daysToExpiry(ttConn?.expiresAt) },
    { platform: "youtube", label: "YouTube", connected: !!ytConn?.accessToken, detail: ytConn?.accountName, expiresInDays: daysToExpiry(ytConn?.expiresAt) },
  ];

  // Map the static 50-post countdown library into composer-ready templates.
  const library = SOCIAL_POSTS.map((p) => ({
    id: p.id,
    caption: p.caption,
    hashtags: p.hashtags,
    channels: toChannelIds(p.channels),
    pillar: p.pillar,
    cta: p.cta,
    graphic: p.graphic,
    day: p.day,
  }));

  // Which channels can auto-publish vs. need a human (drives the banner).
  const configured = await Promise.all((Object.keys(CHANNELS) as ChannelId[]).map(async (c) => [c, await channelConfigured(c)] as const));
  const apiOn = configured.filter(([, on]) => on).map(([c]) => CHANNELS[c as ChannelId].label);

  const upcoming = visible.filter((p) => p.status === "scheduled").sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  const awaiting = visible.filter((p) => p.status === "awaiting" || p.status === "partial");
  const history = visible.filter((p) => ["posted", "failed"].includes(p.status)).sort((a, b) => (b.postedAt ?? b.updatedAt ?? "").localeCompare(a.postedAt ?? a.updatedAt ?? ""));
  const drafts = visible.filter((p) => p.status === "draft");

  return (
    <>
      <PageHeader kicker="Comms · Admin only" title="Social command center" />

      {connected && (
        <div className="mb-6 rounded-sm border border-field/40 bg-field/10 px-4 py-3 text-sm text-field">
          Connected {connected} — auto-publishing is now live for it.
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-sm border border-brick/40 bg-brick/10 px-4 py-3 text-sm text-brick">
          Connection failed: {error}
        </div>
      )}
      <HowTo
        steps={[
          "Compose once, publish to every channel — the per-channel preview flags anything over the character limit, missing hashtags, no CTA, or a missing “Paid for by” line before it ships.",
          "Attach an on-brand graphic (it auto-carries the FEC disclaimer) or paste your own image URL. Generated graphics also live in the Asset library.",
          "Post now, schedule for later, or save a draft. Scheduled posts publish automatically via the background worker at their time.",
          "Channels with API credentials post themselves; the rest are staged in “Ready to post” below with copy-ready text + the image to push by hand — like Buffer’s reminder posts.",
          "Use the Profile Optimizer at the bottom to turn each platform’s analytics into awareness + conversion moves and a single footprint score.",
        ]}
      />

      <div className="mb-6 rounded-sm border border-gold/50 bg-gold/10 px-5 py-4 text-sm text-ink">
        <p className="font-semibold">Publishing mode</p>
        <p className="mt-1 text-slate">
          {apiOn.length > 0 ? (
            <>Auto-publishing is live for: <span className="text-ink">{apiOn.join(", ")}</span>. </>
          ) : (
            <>No platform API credentials are wired yet, so posts are staged for one-tap manual posting (copy text + image). </>
          )}
          Add a channel&apos;s access token (e.g. <code className="font-mono text-xs">X_ACCESS_TOKEN</code>) via SSM to switch it to auto-publish — see{" "}
          <code className="font-mono text-xs">web/docs/social-command-center.md</code>.
        </p>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <SocialConnections providers={providers} />
        <SocialAutoSchedule />
      </div>

      <SocialComposer library={library} />

      {/* Ready to post — manual channels staged by the scheduler */}
      {awaiting.length > 0 && (
        <section className="mt-10">
          <p className="eyebrow text-brick">Ready to post — needs a human</p>
          <div className="mt-3 space-y-3">
            {awaiting.map((p) => (
              <ReadyCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming calendar */}
      <section className="mt-10">
        <p className="eyebrow text-slate">Upcoming calendar</p>
        {upcoming.length > 0 ? (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {upcoming.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-mono text-xs text-field">{when(p.scheduledAt)}</span>{" "}
                  <span className="text-ink">{p.caption.slice(0, 80)}…</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {p.channels.map((c) => (
                      <span key={c} className="rounded-sm px-1.5 py-0.5 font-mono text-[0.55rem] text-paper" style={{ background: CHANNELS[c]?.color ?? "#555" }}>
                        {CHANNELS[c]?.label ?? c}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusChip status={p.status} />
                  <form action={cancelPostAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <ConfirmButton message="Cancel this scheduled post? It won't be published." className="font-mono text-xs text-slate hover:text-brick">cancel</ConfirmButton>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate">Nothing scheduled yet. Compose above and hit Schedule.</p>
        )}
      </section>

      {/* Drafts + history */}
      {drafts.length > 0 && (
        <section className="mt-8">
          <p className="eyebrow text-slate">Drafts</p>
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {drafts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="truncate text-ink">{p.caption.slice(0, 90)}</span>
                <form action={cancelPostAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmButton message="Discard this draft? This can't be undone." className="font-mono text-xs text-slate hover:text-brick">discard</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-8">
          <p className="eyebrow text-slate">Recently posted</p>
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {history.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate text-slate">{p.caption.slice(0, 90)}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusChip status={p.status} />
                  <span className="font-mono text-[0.65rem] text-slate">{when(p.postedAt ?? p.updatedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Profile Optimizer */}
      <section className="mt-12 border-t border-line pt-10">
        <PageHeader kicker="Optimize" title="Profile optimizer" />
        <p className="mb-6 max-w-prose text-sm text-slate">
          Enter each platform&apos;s last-30-day analytics to see where you&apos;re winning attention vs. losing it, how each channel converts, and the
          single highest-leverage move per channel — plus a combined footprint score to track domination over time.
        </p>
        <SocialProfileOptimizer history={snapshots} />
      </section>
    </>
  );
}

function StatusChip({ status }: { status: string }) {
  return <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow ${STATUS_STYLE[status] ?? "bg-ink/5 text-slate"}`}>{status}</span>;
}

function ReadyCard({ post }: { post: ScheduledPost }) {
  const text = composeText(post.caption, post.hashtags) + (post.link ? `\n\n${post.link}` : "");
  const manual = post.channels.filter((c) => post.perChannel[c]?.status === "ready");
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink">{post.caption.slice(0, 140)}…</p>
        <CopyButton text={text} />
      </div>
      <textarea readOnly value={text} rows={3} className="mt-2 w-full rounded-sm border border-line bg-paper/40 px-3 py-2 font-mono text-xs text-slate" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {manual.map((c) => (
          <form key={c} action={confirmPostedAction} className="flex items-center gap-1.5">
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="channel" value={c} />
            <span className="rounded-sm px-1.5 py-0.5 font-mono text-[0.55rem] text-paper" style={{ background: CHANNELS[c]?.color ?? "#555" }}>
              {CHANNELS[c]?.label ?? c}
            </span>
            <button className="rounded-sm border border-line px-2 py-0.5 font-mono text-[0.6rem] text-field hover:border-field">mark posted ✓</button>
          </form>
        ))}
        {post.mediaUrl && (
          <a href={post.mediaUrl} target="_blank" rel="noreferrer" className="font-mono text-[0.65rem] text-field hover:underline">
            open image ↗
          </a>
        )}
      </div>
    </div>
  );
}
