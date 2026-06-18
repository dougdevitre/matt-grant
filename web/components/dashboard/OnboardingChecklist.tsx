import Link from "next/link";
import { sesEnabled } from "@/lib/email/send";
import { congressEnabled } from "@/lib/integrations/legislative/config";

// First-run "Start here" checklist on the dashboard overview. Auto-detects what's
// already set up so it shrinks to a confirmation once everything's done.
export function OnboardingChecklist({ hasData, teamInvited }: { hasData: boolean; teamInvited: number }) {
  const steps = [
    { done: hasData, title: "Add your real data", desc: "Log actual donors, expenditures, and volunteers — demo data is loaded for now.", href: "/dashboard/donors", cta: "Open donors" },
    { done: teamInvited > 0, title: "Invite your team", desc: "Give organizers access to the War Room — instantly, no redeploy.", href: "/dashboard/team", cta: "Invite teammates" },
    { done: sesEnabled, title: "Turn on email", desc: "Verify a sender in SES so receipts and broadcasts actually send.", href: undefined, cta: undefined },
    { done: congressEnabled, title: "Connect opposition research", desc: "Add a Congress.gov key to pull the opponent's record.", href: "/dashboard/research", cta: "Open research" },
  ];
  const completed = steps.filter((s) => s.done).length;

  if (completed === steps.length) {
    return (
      <div className="mb-6 rounded-sm border border-field/40 bg-field/10 px-4 py-3 text-sm text-field">
        ✓ Setup complete — you're fully wired up.
      </div>
    );
  }

  return (
    <div className="mb-6 card p-6">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow text-brick">Start here</p>
        <span className="font-mono text-xs text-slate">{completed}/{steps.length} set up</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full bg-field transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-5 space-y-3">
        {steps.map((s) => (
          <li key={s.title} className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.7rem] ${s.done ? "bg-field text-paper" : "border-2 border-line text-transparent"}`} aria-hidden>✓</span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${s.done ? "text-slate line-through" : "text-ink"}`}>{s.title}</p>
              {!s.done && <p className="mt-0.5 text-xs text-slate">{s.desc}</p>}
            </div>
            {!s.done && s.href && s.cta && (
              <Link href={s.href} className="shrink-0 font-mono text-xs font-bold text-brick hover:underline">{s.cta} →</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
