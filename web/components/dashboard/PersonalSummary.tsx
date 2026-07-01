import Link from "next/link";
import type { Role } from "@/lib/rbac";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { setVoterRegistration } from "@/app/(site)/community/actions";
import { gatherPersonalSignals } from "@/lib/dashboard/personal-data";
import { nextStep, buildChecklist, checklistProgress, type ChecklistItem } from "@/lib/dashboard/personal";

// Personalized "what to do next" summary shown atop /dashboard (staff) and
// /community (supporters). Server component: gathers the signed-in user's signals,
// then renders one suggested next step + the readiness checklist. Self-scoped to
// the passed email (the caller supplies the authenticated address).

const greeting = (hour: number) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
const isExternal = (href: string) => href.startsWith("http");

function ActionLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
  ) : (
    <Link href={href} className={className}>{children}</Link>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${item.done ? "bg-field/15 text-field" : "border border-line text-slate"}`}
        aria-hidden
      >
        {item.done ? "✓" : "○"}
      </span>
      <span className="min-w-0 flex-1">
        <span className={item.done ? "text-ink" : "text-ink"}>{item.label}</span>
        <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
          {item.done ? "Done" : "To do"}
        </span>
      </span>

      {item.key === "register" ? (
        <span className="flex items-center gap-3">
          <ActionLink href={item.cta.href} className="text-xs font-semibold text-brick underline">
            {item.cta.text}
          </ActionLink>
          <form action={setVoterRegistration}>
            <input type="hidden" name="registered" value={item.done ? "false" : "true"} />
            <SubmitButton
              pendingText="Saving…"
              className="rounded-sm border border-line px-2.5 py-1 text-xs text-slate hover:border-ink hover:text-ink disabled:opacity-50"
            >
              {item.done ? "Undo" : "Mark me registered"}
            </SubmitButton>
          </form>
        </span>
      ) : (
        !item.done && (
          <ActionLink href={item.cta.href} className="text-xs font-semibold text-brick underline">
            {item.cta.text}
          </ActionLink>
        )
      )}
      {item.key !== "register" && item.done && (
        <span className="text-xs text-slate">{item.cta.text}</span>
      )}
    </li>
  );
}

export async function PersonalSummary({ email, role }: { email: string | null | undefined; role: Role }) {
  const now = new Date();
  const signals = await gatherPersonalSignals(email, role, now);
  const step = nextStep(signals);
  const items = buildChecklist(signals);
  const progress = checklistProgress(items);
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <section className="mb-8 rounded-lg border border-line bg-white p-5 shadow-card sm:p-6" aria-label="Your next step">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="eyebrow text-slate">{greeting(now.getHours())} · {dateLabel}</p>
        {signals.daysToPrimary != null && (
          <p className="font-mono text-[0.65rem] uppercase tracking-eyebrow text-brick">
            Primary in {signals.daysToPrimary} {signals.daysToPrimary === 1 ? "day" : "days"}
          </p>
        )}
      </div>

      {/* Suggested next step */}
      <div className="mt-3 rounded-sm border border-line bg-paper p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-brick">Your next step</p>
        <p className="mt-1 font-display text-lg text-ink">{step.title}</p>
        <p className="mt-1 text-sm text-slate">{step.detail}</p>
        <ActionLink href={step.href} className="mt-2 inline-block text-sm font-semibold text-brick underline">
          {step.cta} →
        </ActionLink>
      </div>

      {/* Readiness checklist */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow text-slate">Your checklist</p>
          <p className="font-mono text-xs text-slate">{progress.done} of {progress.total} done</p>
        </div>
        <ul className="mt-2 divide-y divide-line rounded-sm border border-line">
          {items.map((item) => <ChecklistRow key={item.key} item={item} />)}
        </ul>
      </div>
    </section>
  );
}
