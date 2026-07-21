import { redirect } from "next/navigation";
import Link from "next/link";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { listConversations } from "@/lib/messenger/conversations";
import { messengerReadiness } from "@/lib/messenger/health";

export const dynamic = "force-dynamic";

const CHANNEL_BADGE: Record<string, { label: string; cls: string }> = {
  messenger: { label: "Messenger", cls: "bg-field/10 text-field" },
  instagram: { label: "Instagram", cls: "bg-brick/10 text-brick" },
};

export default async function MetaInboxPage() {
  const { role } = await staffGate();
  if (!can(role, "messageIndividuals")) redirect("/dashboard?denied=messageIndividuals");

  const [convos, readiness] = await Promise.all([listConversations(), messengerReadiness()]);
  const open = convos.filter((c) => c.status !== "archived");

  return (
    <>
      <Link href="/dashboard/messages" className="font-mono text-xs uppercase tracking-eyebrow text-slate hover:text-ink">
        ← Text inbox
      </Link>
      <PageHeader kicker="Comms" title="Messenger &amp; Instagram inbox" />
      <HowTo
        steps={[
          "People who message the campaign on Facebook Messenger or Instagram land here as threads — reply as the campaign Page, by hand.",
          "Meta only lets you reply within 24 hours of someone's last message. A thread past that window shows the reason and disables the reply box.",
          "A ⚠ flag marks inappropriate language for your review — it never auto-blocks. Use Block on a thread to stop an abusive sender.",
          "Nothing here auto-replies; every message is sent by a person.",
        ]}
      />

      {readiness.state !== "live" && (
        <div className="mb-6 rounded-sm border border-gold/50 bg-gold/10 px-5 py-4 text-sm text-ink">
          <p className="font-semibold">Messenger isn&apos;t fully connected yet.</p>
          <p className="mt-1 text-slate">
            Present: {[readiness.pageToken && "Page token", readiness.appSecret && "app secret", readiness.verifyToken && "verify token"].filter(Boolean).join(", ") || "none"}.
            Finish the Meta setup (see <span className="font-mono">web/docs/messenger-inbox.md</span>) — including the <span className="font-mono">pages_messaging</span> review — to receive and reply. Threads still display here.
          </p>
        </div>
      )}

      <div className="mt-6">
        <p className="eyebrow text-slate">Conversations</p>
        {open.length === 0 ? (
          <p className="mt-3 text-sm text-slate">No Messenger or Instagram conversations yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line bg-white">
            {open.map((c) => {
              const badge = CHANNEL_BADGE[c.platform] ?? CHANNEL_BADGE.messenger;
              return (
                <li key={c.key}>
                  <Link href={`/dashboard/messages/social/${encodeURIComponent(c.key)}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow ${badge.cls}`}>{badge.label}</span>
                        <span className="truncate">{c.name || c.psid}</span>
                        {c.flaggedCount > 0 && <span title="Flagged for review">⚠</span>}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate">
                        {c.lastDirection === "out" ? "You: " : ""}
                        {c.lastBody || "(no message)"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {c.unread > 0 && <span className="rounded-full bg-brick px-2 py-0.5 font-mono text-[0.6rem] text-paper">{c.unread}</span>}
                      <p className="mt-1 font-mono text-[0.6rem] text-slate">
                        {c.lastAt ? new Date(c.lastAt).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
