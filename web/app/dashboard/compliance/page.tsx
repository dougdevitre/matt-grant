import { redirect } from "next/navigation";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// Standard FEC reporting cadence for a 2026 U.S. House candidate. Federal
// candidates file with the FEC only — NOT the Missouri Ethics Commission
// (MEC handles state/local races). Dates follow the usual schedule and MUST be
// verified against fec.gov before each filing; they are not legal advice.
type Deadline = {
  date: string; // ISO
  report: string;
  covers: string;
  kind: "Quarterly" | "Pre-Primary" | "Pre-General" | "Year-End" | "48-Hour";
};

const DEADLINES: Deadline[] = [
  { date: "2026-04-15", report: "April Quarterly (Form 3)", covers: "Jan 1 – Mar 31", kind: "Quarterly" },
  { date: "2026-07-15", report: "July Quarterly (Form 3)", covers: "Apr 1 – Jun 30", kind: "Quarterly" },
  { date: "2026-07-23", report: "Pre-Primary Report", covers: "through Jul 15 (12 days before Aug 4)", kind: "Pre-Primary" },
  { date: "2026-08-04", report: "MO-02 Primary — Election Day", covers: "polls close", kind: "Pre-Primary" },
  { date: "2026-10-15", report: "October Quarterly (Form 3)", covers: "Jul 1 – Sep 30", kind: "Quarterly" },
  { date: "2026-10-22", report: "Pre-General Report", covers: "through Oct 14 (12 days before Nov 3)", kind: "Pre-General" },
  { date: "2027-01-31", report: "Year-End Report", covers: "Oct 1 – Dec 31", kind: "Year-End" },
];

const kindColor: Record<Deadline["kind"], string> = {
  Quarterly: "text-field",
  "Pre-Primary": "text-brick",
  "Pre-General": "text-brick",
  "Year-End": "text-slate",
  "48-Hour": "text-gold-ink",
};

export default async function CompliancePage() {
  if (!can((await staffGate()).role, "viewCompliance")) redirect("/dashboard?denied=compliance");
  // Server component: current time resolves at request render, which is correct here.
  const now = Date.now();
  const fmt = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <>
      <PageHeader kicker="Compliance" title="Filing calendar" />

      <HowTo
        steps={[
          "Read each row left to right: filing date, the report and what it covers, and the countdown badge (“in N d”, “today”, or “filed/past”).",
          "Remember Matt files with the FEC, not the Missouri Ethics Commission — he is a federal candidate.",
          "Confirm every date at fec.gov before you file; these follow the standard schedule but are not legal advice.",
          "Watch for 48-hour notices on contributions of $1,000+ in the final stretch before Aug 4.",
          "For the full rules, open the linked skill files (compliance-calendar.md, disclosure-requirements.md).",
        ]}
      />

      <div className="mb-6 rounded-sm border border-gold/50 bg-gold/10 px-5 py-4 text-sm text-ink">
        <p className="font-semibold">Federal candidate — file with the FEC, not the MEC.</p>
        <p className="mt-1 text-slate">
          U.S. House candidates report to the Federal Election Commission. Dates below follow the standard
          schedule and must be verified at{" "}
          <a className="text-field underline" href="https://www.fec.gov/help-candidates-and-committees/dates-and-deadlines/" target="_blank" rel="noopener noreferrer">
            fec.gov dates &amp; deadlines
          </a>
          . Also watch <span className="font-semibold">48-hour notices</span> for contributions of $1,000+ received
          between 20 days and 48 hours before the primary. Educational, not legal advice.
        </p>
      </div>

      <ol className="card divide-y divide-line p-0">
        {DEADLINES.map((d) => {
          const t = new Date(d.date + "T12:00:00").getTime();
          const days = Math.ceil((t - now) / 86400000);
          const past = days < 0;
          return (
            <li key={d.date + d.report} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="w-28 shrink-0">
                <p className="font-mono text-sm font-semibold text-ink">{fmt(d.date)}</p>
                <p className={`font-mono text-[0.6rem] uppercase tracking-eyebrow ${kindColor[d.kind]}`}>{d.kind}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${past ? "text-slate line-through" : "text-ink"}`}>{d.report}</p>
                <p className="text-xs text-slate">Covers: {d.covers}</p>
              </div>
              <span
                className={`shrink-0 rounded-sm px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-eyebrow ${
                  past ? "bg-line text-slate" : days <= 14 ? "bg-brick/10 text-brick" : "bg-field/10 text-field"
                }`}
              >
                {past ? "filed/past" : days === 0 ? "today" : `in ${days}d`}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-xs text-slate">
        See <span className="font-mono">federal/compliance-calendar.md</span> and{" "}
        <span className="font-mono">federal/disclosure-requirements.md</span> in the skill for the full rules.
      </p>
    </>
  );
}
