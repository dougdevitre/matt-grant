// Does an email look like an EXTERNAL party — press / government / an org role
// inbox — rather than a campaign teammate? Advisory only. Used to warn an admin
// before they invite the address into the STAFF table, which grants internal
// dashboard access the moment that email signs up (see the team invite flow).
//
// The standalone `scripts/staff-list.mjs` keeps an inline copy of these two lists
// (it's plain node ESM and can't import this TS module); `roles-consistency.test.ts`
// asserts the copy stays identical, so the heuristic lives in exactly one place.

export type ExternalKind = "" | "press/org" | "gov/mil" | "role-addr";

// Outlets / orgs whose addresses are not campaign staff.
export const EXTERNAL_DOMAINS = [
  "nytimes.com", "latimes.com", "foxnews.com", "kcstar.com", "kfvs12.com", "fox4kc.com",
  "semissourian.com", "missouriindependent.com", "stlamerican.com", "firstalert4.com",
  "beehiiv.com", "aclu-mo.org",
];

// Local-parts that signal a role inbox (a desk/queue), not an individual.
export const EXTERNAL_LOCALPARTS = [
  "tips", "news", "newsroom", "editor", "publisher", "intake", "investigates", "speakout",
  "outreach", "contact", "press", "media", "info", "foxnewsinsider",
];

const LOCALPART_SET = new Set(EXTERNAL_LOCALPARTS);

/** "" when the address looks like an ordinary person; otherwise the reason it looks external. */
export function looksExternal(email: string): ExternalKind {
  const [local = "", domain = ""] = String(email).toLowerCase().trim().split("@");
  if (!domain) return "";
  if (domain.endsWith(".gov") || domain.endsWith(".mil")) return "gov/mil";
  if (EXTERNAL_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) return "press/org";
  if (LOCALPART_SET.has(local)) return "role-addr";
  return "";
}
