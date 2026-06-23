"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

// Renders a dismissible notice when a page redirects here with ?denied=<section>
// because the signed-in user's role lacks access. Pair with the RBAC redirects
// (e.g. redirect("/dashboard?denied=finance")).
//
// Wiring note: must be rendered inside a <Suspense> boundary (useSearchParams),
// e.g. in the dashboard layout's main column.
const LABELS: Record<string, string> = {
  donors: "Donors",
  finance: "Finance",
  compliance: "Compliance",
  team: "Team & access",
  campaign: "Email campaigns",
};

export function DeniedBanner() {
  const denied = useSearchParams().get("denied");
  const [dismissed, setDismissed] = useState(false);
  if (!denied || dismissed) return null;

  const label = LABELS[denied] ?? "that section";
  return (
    <div
      role="status"
      className="mb-6 flex items-start justify-between gap-4 rounded-sm border border-brick/40 bg-brick/5 px-5 py-4 text-sm text-ink"
    >
      <p>
        <span className="font-semibold">Access restricted.</span>{" "}
        <span className="text-slate">
          {label} is limited to admins. Ask a campaign admin if you need access.
        </span>
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-sm border border-line px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-eyebrow text-slate hover:border-ink hover:text-ink"
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
