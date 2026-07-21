import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import { MessengerThread } from "@/components/dashboard/MessengerThread";
import { getThread, getConversation, markRead, isSenderBlocked, canReplyNow, parseKey } from "@/lib/messenger/conversations";
import { blockSenderAction, unblockSenderAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function MetaThreadPage({ params }: { params: Promise<{ key: string }> }) {
  const { role } = await staffGate();
  if (!can(role, "messageIndividuals")) redirect("/dashboard?denied=messageIndividuals");

  const { key: raw } = await params;
  const key = decodeURIComponent(raw);
  const parsed = parseKey(key);
  if (!parsed) notFound();

  const [messages, convo, blocked] = await Promise.all([getThread(key), getConversation(key), isSenderBlocked(key)]);
  await markRead(key); // opening clears the unread count

  const channel = parsed.platform === "instagram" ? "Instagram" : "Messenger";
  const decision = canReplyNow({ blocked, lastInboundAt: convo?.lastInboundAt });

  return (
    <>
      <Link href="/dashboard/messages/social" className="font-mono text-xs uppercase tracking-eyebrow text-slate hover:text-ink">
        ← Messenger &amp; Instagram inbox
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{convo?.name || parsed.psid}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate">
            <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${channel === "Instagram" ? "bg-brick/10 text-brick" : "bg-field/10 text-field"}`}>{channel}</span>
            {blocked && <span className="rounded-sm bg-brick/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-brick">Blocked</span>}
          </p>
        </div>

        {blocked ? (
          <form action={unblockSenderAction}>
            <input type="hidden" name="key" value={key} />
            <button type="submit" className="rounded-sm border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink">Unblock</button>
          </form>
        ) : (
          <form action={blockSenderAction}>
            <input type="hidden" name="key" value={key} />
            <ConfirmButton
              message={`Block this ${channel} sender? Their inbound messages will be ignored and you won't be able to reply.`}
              className="rounded-sm border border-line px-3 py-1.5 text-xs font-semibold text-brick hover:border-brick"
            >
              Block
            </ConfirmButton>
          </form>
        )}
      </div>

      <MessengerThread
        messengerKey={key}
        channel={channel}
        messages={messages.map((m) => ({ direction: m.direction, body: m.body, createdAt: m.createdAt, status: m.status, flagged: m.flagged }))}
        canReply={decision.allowed}
        reason={decision.reason}
        windowEndsAt={decision.windowEndsAt}
      />
    </>
  );
}
