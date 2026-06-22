import { redirect } from "next/navigation";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// Post-auth router: sends a signed-in user to THEIR dashboard based on role.
// `fallbackRedirectUrl` on sign-in/up points here, so everyone lands on the right
// home automatically (protected-route bounces still honor their own redirect_url).
// A brand-new signup whose role hasn't stamped yet (can() is false for null) falls
// through to /community — the supporter floor — which is correct.
export default async function GoPage() {
  const { role } = await staffGate();
  if (can(role, "viewOverview")) redirect("/dashboard"); // admin / captain / member
  if (can(role, "viewPeaceRoom")) redirect("/dashboard/peace-room"); // partner
  redirect("/community"); // supporter / donor / not-yet-stamped
}
