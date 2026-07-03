import { redirect } from "next/navigation";
import { staffGate } from "@/lib/auth";
import { postAuthDestination } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// Post-auth router: sends a signed-in user to THEIR dashboard based on role.
// `fallbackRedirectUrl` on sign-in/up points here, so everyone lands on the right
// home automatically (protected-route bounces still honor their own redirect_url).
// The role→destination mapping lives in postAuthDestination (lib/rbac.ts) so it's
// unit-testable in isolation; a brand-new signup whose role hasn't stamped yet
// falls through to /community — the supporter floor — which is correct.
export default async function GoPage() {
  const { role } = await staffGate();
  redirect(postAuthDestination(role));
}
