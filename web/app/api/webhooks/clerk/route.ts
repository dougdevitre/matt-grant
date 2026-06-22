import { NextResponse, type NextRequest } from "next/server";
import { emailAllowed } from "@/lib/auth";
import { staffRole } from "@/lib/staff";
import { asRole } from "@/lib/rbac";

// Clerk webhook: on user.created, stamp the new user's RBAC role into Clerk
// publicMetadata so it travels with the session everywhere.
//
// Role source of truth at first sign-in:
//   1. env DASHBOARD_ALLOWLIST  → "admin"  (the two bootstrap admins)
//   2. an active invited staff row (DynamoDB) → that row's role  (pending invite)
//   3. otherwise → "supporter" — the public community floor, so every self-signup
//      lands in the /community hub (Peace Room launch). Supporter has NO staff or
//      private capabilities, so this is safe to default broadly.
//
// Requires CLERK_WEBHOOK_SIGNING_SECRET (Clerk dashboard → Webhooks → Signing
// Secret). Inert without it so keyless builds/deploys still pass.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    return NextResponse.json({ ok: false, skipped: "no signing secret" }, { status: 200 });
  }

  // Verify the Svix signature (reads CLERK_WEBHOOK_SIGNING_SECRET from env).
  let evt: { type: string; data: Record<string, unknown> };
  try {
    const { verifyWebhook } = await import("@clerk/nextjs/webhooks");
    // App Router's Web `Request` satisfies verifyWebhook at runtime; its param
    // type (RequestLike) is narrower, so cast to it.
    evt = (await verifyWebhook(req as unknown as Parameters<typeof verifyWebhook>[0])) as unknown as typeof evt;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 400 });
  }

  if (evt.type !== "user.created") {
    return NextResponse.json({ ok: true, ignored: evt.type });
  }

  const data = evt.data as {
    id?: string;
    first_name?: string | null;
    email_addresses?: { id: string; email_address: string }[];
    primary_email_address_id?: string;
  };
  const userId = data.id;
  const primary =
    data.email_addresses?.find((e) => e.id === data.primary_email_address_id) ??
    data.email_addresses?.[0];
  const email = primary?.email_address ?? null;

  if (!userId || !email) {
    return NextResponse.json({ ok: true, note: "no user id / email" });
  }

  // Bootstrap admin (only when an allowlist is actually set) → invited staff row →
  // otherwise the public "supporter" floor so a new account always lands somewhere.
  const assigned = emailAllowed(email) && process.env.DASHBOARD_ALLOWLIST ? "admin" : await staffRole(email);
  const role = asRole(assigned) ?? "supporter";

  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, { publicMetadata: { role } });
  } catch {
    return NextResponse.json({ ok: false, error: "failed to set role" }, { status: 500 });
  }

  // Welcome new public supporters. Staff/partner invitees already get their own
  // invite email, so only the self-signup "supporter" floor is welcomed here.
  // Best-effort: a mail hiccup must never fail the webhook (Clerk would retry).
  let welcomed = false;
  if (role === "supporter") {
    try {
      const { sesEnabled, sendEmail } = await import("@/lib/email/send");
      if (sesEnabled) {
        const { supporterWelcome } = await import("@/lib/email/templates");
        const tpl = supporterWelcome((data.first_name || "there").trim() || "there");
        const res = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
        welcomed = res.sent;
      }
    } catch {
      /* welcome email is non-critical */
    }
  }

  return NextResponse.json({ ok: true, email, role, welcomed });
}
