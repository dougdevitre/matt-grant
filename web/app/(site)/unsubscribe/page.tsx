import type { Metadata } from "next";
import { TOPICS, getPreferences, verifyUnsubToken } from "@/lib/subscribers";
import { savePreferences } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Email preferences", robots: { index: false, follow: false } };

// Token-gated preference center. Lets a recipient opt out of individual topics
// or unsubscribe from everything. The List-Unsubscribe one-click header still
// hits /api/unsubscribe for an immediate global opt-out.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; saved?: string; error?: string }>;
}) {
  const { token, saved, error } = await searchParams;
  const email = token ? await verifyUnsubToken(token) : null;

  if (!email) {
    return (
      <section className="container-page py-20 sm:py-28">
        <p className="eyebrow text-brick">Email preferences</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Link expired or invalid.</h1>
        <p className="mt-4 max-w-prose text-slate">
          We couldn&apos;t open your preferences. Email{" "}
          <a className="text-brick underline" href="mailto:mattgrantforcongress@gmail.com">
            mattgrantforcongress@gmail.com
          </a>{" "}
          and we&apos;ll update you right away.
        </p>
      </section>
    );
  }

  const prefs = await getPreferences(email);
  const allOff = prefs.status === "unsubscribed";

  return (
    <section className="container-page py-20 sm:py-28">
      <p className="eyebrow text-brick">Email preferences</p>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">Manage your email preferences</h1>
      <p className="mt-3 font-mono text-sm text-slate">{email}</p>

      {saved && (
        <p className="mt-5 rounded-sm border border-field/40 bg-field/5 px-4 py-3 text-sm text-field">
          Saved — your preferences are updated.
        </p>
      )}
      {error && (
        <p className="mt-5 rounded-sm border border-brick/40 bg-brick/5 px-4 py-3 text-sm text-brick">
          That link expired. Open the link from your most recent email.
        </p>
      )}
      {allOff && !saved && (
        <p className="mt-5 rounded-sm border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-ink">
          You&apos;re currently unsubscribed from all campaign emails. Re-check any topics below and save to resume.
        </p>
      )}

      <form action={savePreferences} className="mt-8 max-w-xl">
        <input type="hidden" name="token" value={token} />
        <p className="text-sm font-semibold text-ink">Send me:</p>
        <div className="mt-3 divide-y divide-line rounded-sm border border-line">
          {TOPICS.map((t) => (
            <label key={t.key} className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm">
              <input
                type="checkbox"
                name="subscribed"
                value={t.key}
                defaultChecked={!allOff && !prefs.optOut.includes(t.key)}
                className="h-4 w-4 accent-brick"
              />
              <span className="text-ink">{t.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="submit" className="btn-primary">Save preferences</button>
          <button type="submit" name="action" value="all" className="rounded-sm border border-line px-4 py-2 text-sm text-brick hover:border-brick">
            Unsubscribe from all
          </button>
        </div>
      </form>

      <p className="mt-8 max-w-prose text-xs text-slate">
        Transactional messages you request — like a donation receipt or a reply to your message — are always
        delivered. Paid for by the Matt Grant for Congress Committee.
      </p>
    </section>
  );
}
