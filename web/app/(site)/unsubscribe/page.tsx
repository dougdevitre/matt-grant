import type { Metadata } from "next";
import { suppress, verifyUnsubToken } from "@/lib/subscribers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

// One-click unsubscribe target for broadcast emails. The token carries the
// email (signed), so visiting the link immediately suppresses that address.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const email = token ? verifyUnsubToken(token) : null;
  let done = false;
  if (email) {
    try {
      await suppress(email);
      done = true;
    } catch {
      done = false;
    }
  }

  return (
    <section className="container-page py-20 sm:py-28">
      <p className="eyebrow text-brick">Email preferences</p>
      {done ? (
        <>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">You&apos;re unsubscribed.</h1>
          <p className="mt-4 max-w-prose text-slate">
            <span className="font-mono text-sm">{email}</span> will no longer receive campaign broadcast
            emails. You may still get transactional messages you request (like a donation receipt).
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">Link expired or invalid.</h1>
          <p className="mt-4 max-w-prose text-slate">
            We couldn&apos;t process that unsubscribe link. Email{" "}
            <a className="text-brick underline" href="mailto:mattgrantforcongress@gmail.com">
              mattgrantforcongress@gmail.com
            </a>{" "}
            and we&apos;ll remove you right away.
          </p>
        </>
      )}
    </section>
  );
}
