// Cross-engagement join for the dashboard: which supporters appear in BOTH the
// donor and volunteer lists, so staff can spot the most-engaged people — a donor
// who also volunteers, a volunteer who has also given. Pure and set-based: one
// pass over each list, no per-row database lookups (unlike the self-scoped
// supporterTier, which is for a single signed-in user). RBAC is unaffected; this
// only annotates lists staff can already see.

const norm = (email?: string | null): string => (email ?? "").trim().toLowerCase();

// Build a lowercased, de-duplicated set of the emails present in a list of rows.
export function emailSet(rows: Array<{ email?: string | null }>): Set<string> {
  const s = new Set<string>();
  for (const r of rows) {
    const e = norm(r.email);
    if (e) s.add(e);
  }
  return s;
}

// Case-insensitive membership test; a blank email is never a member.
export function isIn(set: Set<string>, email?: string | null): boolean {
  const e = norm(email);
  return !!e && set.has(e);
}
