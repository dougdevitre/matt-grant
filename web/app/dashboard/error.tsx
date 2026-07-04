"use client";

// Scoped error boundary for the dashboard segment. Without it, a thrown error in any
// dashboard page bubbles to the root app/error.tsx (a full-screen hero) and blows away
// the whole dashboard shell — sidebar, chrome, and all. This localizes the failure to
// the content area so the rest of the dashboard stays usable, and reports it the same
// way the root boundary does.
import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, { kind: "route-error", digest: error.digest ?? "" });
  }, [error]);
  return (
    <div className="card border-brick/40 bg-brick/5 p-8">
      <p className="eyebrow text-brick">Something went wrong</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">This section hit a snag.</h1>
      <p className="mt-2 max-w-prose text-sm text-slate">
        The rest of the dashboard is fine — just this view failed to load. Try again; if it keeps
        happening, the error has been logged for the team.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={reset} className="btn-primary">Try again</button>
        <a href="/dashboard" className="btn-ghost">Back to overview</a>
      </div>
    </div>
  );
}
