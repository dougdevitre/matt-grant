import { clerkEnabled } from "@/lib/auth";

// Shown across the dashboard when the database isn't connected yet, so staff
// understand they're looking at the shell, not live data.
export function DbNotice() {
  return (
    <div className="mb-6 rounded-sm border border-gold/50 bg-gold/10 px-5 py-4 text-sm text-ink">
      <p className="font-semibold">Database not connected.</p>
      <p className="mt-1 text-slate">
        Set <code className="font-mono text-xs">DYNAMODB_TABLE</code> (+ AWS creds), then run{" "}
        <code className="font-mono text-xs">npm run db:create-table</code> and{" "}
        <code className="font-mono text-xs">npm run db:seed</code>. Until then the manager shows
        empty state.
        {!clerkEnabled && (
          <>
            {" "}Add Clerk keys to require staff sign-in (currently open in demo mode).
          </>
        )}
      </p>
    </div>
  );
}

// Collapsible "How to use this page" panel. Steps are plain strings or JSX;
// rendered as a numbered list inside an on-brand <details> so the guidance is
// available without crowding the working area.
export function HowTo({ steps, title = "How to use this page" }: { steps: React.ReactNode[]; title?: string }) {
  return (
    <details className="group mb-6 rounded-sm border border-line bg-paper/60 px-5 py-3 text-sm text-slate [&_a]:text-field [&_a]:underline [&_code]:font-mono [&_code]:text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-xs uppercase tracking-eyebrow text-field">
        <span className="transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
        {title}
      </summary>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 marker:font-mono marker:text-field/70">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </details>
  );
}

export function PageHeader({ title, kicker, children }: { title: string; kicker: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow text-brick">{kicker}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
