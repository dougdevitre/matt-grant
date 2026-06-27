import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { myGiving } from "@/lib/donorStatus";
import { dollars } from "@/lib/money";
import { CAMPAIGN } from "@/lib/site";
import { CtaButton } from "@/components/CtaButton";

// The donor portal: a logged-in donor's PRIVATE view of their OWN giving — total,
// gift count, and each contribution. Self-scoped to gate.email (myGiving reads only
// that one donor row), so it never exposes the internal donor list / anyone's PII.
// Gated by the viewDonorPortal capability (donor + admin); a plain supporter is
// sent to the public community hub.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My giving — Matt Grant for Congress",
  robots: { index: false, follow: false },
};

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default async function MyGivingPage() {
  const gate = await staffGate();
  if (!gate.ok) redirect("/sign-in");
  if (!can(gate.role, "viewDonorPortal")) redirect("/community");

  const giving = await myGiving(gate.email);

  return (
    <div className="container-page py-12">
      <p className="eyebrow text-brick">Your support</p>
      <h1 className="mt-1 font-display text-4xl font-semibold text-ink">My giving</h1>
      <p className="mt-2 max-w-2xl text-slate">
        A private summary of your contributions — only you can see this. Official receipts are emailed by our
        payment processor at the time of each gift.
      </p>

      {giving.hasDonated ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:max-w-xl">
            <div className="card p-5">
              <p className="eyebrow text-slate">Total given</p>
              <p className="mt-1 font-display text-3xl font-semibold text-ink">{dollars(giving.totalCents)}</p>
            </div>
            <div className="card p-5">
              <p className="eyebrow text-slate">Gifts</p>
              <p className="mt-1 font-display text-3xl font-semibold text-ink">{giving.gifts}</p>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-eyebrow text-slate">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Election</th>
                </tr>
              </thead>
              <tbody>
                {giving.lines.map((g, i) => {
                  const refund = (g.amountCents ?? 0) < 0 || g.type === "refund";
                  return (
                    <tr key={i} className="border-t border-line/70">
                      <td className="px-4 py-3 text-ink">{when(g.receivedAt)}</td>
                      <td className={`px-4 py-3 font-semibold ${refund ? "text-brick" : "text-ink"}`}>
                        {refund ? "−" : ""}
                        {dollars(Math.abs(g.amountCents ?? 0))}
                        {refund ? " (refund)" : ""}
                      </td>
                      <td className="px-4 py-3 text-slate">{g.method || "—"}</td>
                      <td className="px-4 py-3 text-slate">{g.election || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-8">
            <CtaButton href={CAMPAIGN.donateUrl} external context="donate">Give again</CtaButton>
            <Link href="/community" className="btn-ghost ml-3">Our Community</Link>
          </div>
        </>
      ) : (
        <div className="mt-8 max-w-xl rounded-lg border border-line bg-white p-6">
          <p className="font-display text-lg font-semibold text-ink">No gifts on record yet.</p>
          <p className="mt-1 text-sm text-slate">
            When you contribute, your gifts will appear here — usually right after our payment processor confirms them.
          </p>
          <CtaButton href={CAMPAIGN.donateUrl} external context="donate" className="btn-primary mt-4">
            Donate
          </CtaButton>
        </div>
      )}
    </div>
  );
}
