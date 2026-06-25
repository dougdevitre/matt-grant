// Compact accept-status pill for the Team page. Acceptance is a stateless join in
// the page (Clerk's pending list is the source of truth) — this just renders the
// resulting boolean: green "Accepted" once they've signed in, amber "Pending" until.
export function InviteStatusBadge({ accepted }: { accepted: boolean }) {
  const base = "rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow";
  return accepted ? (
    <span className={`${base} bg-field/10 text-field`}>Accepted ✓</span>
  ) : (
    <span className={`${base} bg-amber-100 text-amber-700`}>Pending</span>
  );
}
