"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { staffGate, VIEW_AS_COOKIE } from "@/lib/auth";
import { asRole } from "@/lib/rbac";
import { recordPreviewSwitch } from "@/lib/audit";

// Admin-only "view as role" preview. Setting the cookie makes staffGate() return
// the previewed role as the EFFECTIVE role everywhere (nav, page gates, actions),
// so an admin can verify exactly what each lower role can and can't see. The
// override only ever reduces capability and is re-gated server-side here, so it
// can never be used to escalate.

export async function setViewAs(role: string): Promise<void> {
  const { actualRole, email } = await staffGate();
  if (actualRole !== "admin") return; // only a real admin may preview
  const target = asRole(role);
  if (!target || target === "admin") return; // "admin" = exit; invalid = ignore
  const jar = await cookies();
  jar.set(VIEW_AS_COOKIE, target, { httpOnly: true, sameSite: "lax", path: "/" }); // session cookie
  // Accountability: record who previewed which role, when (best-effort).
  const who = email ?? "system";
  await recordPreviewSwitch({ at: new Date().toISOString(), actor: who, target: who, action: "preview_enter", role: target });
  revalidatePath("/dashboard", "layout");
}

export async function clearViewAs(): Promise<void> {
  // Read the active preview (cookie still set) before clearing, so we can log it.
  // No gate needed: clearing only ever returns the caller to their real role.
  const { email, viewingAs } = await staffGate();
  const jar = await cookies();
  jar.delete(VIEW_AS_COOKIE);
  if (viewingAs) {
    const who = email ?? "system";
    await recordPreviewSwitch({ at: new Date().toISOString(), actor: who, target: who, action: "preview_exit", role: viewingAs });
  }
  revalidatePath("/dashboard", "layout");
}
