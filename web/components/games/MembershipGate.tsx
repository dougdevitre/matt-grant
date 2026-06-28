"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getGameMeta } from "@/lib/games/registry";

// Shown when an anonymous visitor tries a second game. Free game already spent → invite
// them to join (a free account) to unlock the rest. The page's SiteFooter carries the
// FEC disclaimer, so this card doesn't repeat it.

export function MembershipGate({
  gameId,
  freeGameId,
  clerkEnabled,
}: {
  gameId: string;
  freeGameId: string | null;
  clerkEnabled: boolean;
}) {
  const pathname = usePathname() || `/games/${gameId}`;
  const redirect = encodeURIComponent(pathname);
  const freeTitle = freeGameId ? getGameMeta(freeGameId)?.title : null;
  const thisTitle = getGameMeta(gameId)?.title ?? "this game";

  return (
    <section className="mx-auto max-w-xl rounded-lg border border-line bg-white p-8 text-center shadow-card" aria-labelledby="gate-heading">
      <p className="eyebrow text-slate">Members play all four</p>
      <h1 id="gate-heading" className="mt-2 text-3xl font-semibold sm:text-4xl">
        Join to play {thisTitle}
      </h1>
      <p className="mt-3 text-slate">
        {freeTitle ? <>You&apos;ve used your free game ({freeTitle}). </> : <>You&apos;ve used your free game. </>}
        Become a member — it&apos;s free and takes a few seconds — to unlock the rest of the Four Fights arcade.
      </p>

      {clerkEnabled ? (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/sign-up?redirect_url=${redirect}`} className="btn-brick">
            Sign up free
          </Link>
          <Link href={`/sign-in?redirect_url=${redirect}`} className="btn-ghost">
            Already a member? Sign in
          </Link>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate">Membership sign-up isn&apos;t available in this environment.</p>
      )}

      <p className="mt-6 text-sm text-slate">
        <Link href="/games" className="underline hover:text-ink">
          ← Back to the arcade
        </Link>
      </p>
    </section>
  );
}
