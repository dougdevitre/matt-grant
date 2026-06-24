"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { staffGate, VIEW_AS_COOKIE } from "@/lib/auth";
import { asRole } from "@/lib/rbac";

// Admin-only "view as role" preview. Setting the cookie makes staffGate() return
// the previewed role as the EFFECTIVE role everywhere (nav, page gates, actions),
// so an admin can verify exactly what each lower role can and can't see. The
// override only ever reduces capability and is re-gated server-side here, so it
// can never be used to escalate.

export async function setViewAs(role: string): Promise<void> {
  const { actualRole } = await staffGate();
  if (actualRole !== "admin") return; // only a real admin may preview
  const target = asRole(role);
  if (!target || target === "admin") return; // "admin" = exit; invalid = ignore
  const jar = await cookies();
  jar.set(VIEW_AS_COOKIE, target, { httpOnly: true, sameSite: "lax", path: "/" }); // session cookie
  revalidatePath("/dashboard", "layout");
}

export async function clearViewAs(): Promise<void> {
  // No gate needed: clearing only ever returns the caller to their real role.
  const jar = await cookies();
  jar.delete(VIEW_AS_COOKIE);
  revalidatePath("/dashboard", "layout");
}
