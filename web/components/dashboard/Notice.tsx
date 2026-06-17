import { clerkEnabled } from "@/lib/auth";

// Shown across the dashboard when the database isn't connected yet, so staff
// understand they're looking at the shell, not live data.
export function DbNotice() {
  return (
    <div className="mb-6 rounded-sm border border-gold/50 bg-gold/10 px-5 py-4 text-sm text-ink">
      <p className="font-semibold">Database not connected.</p>
      <p className="mt-1 text-slate">
        Set <code className="font-mono text-xs">DATABASE_URL</code> (Vercel Postgres / Neon), then run{" "}
        <code className="font-mono text-xs">npm run db:push</code> and{" "}
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
