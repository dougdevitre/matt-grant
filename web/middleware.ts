import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { pillarOrVanityResponse } from "@/lib/pillar-middleware";

// Host-based pillar/vanity routing (pillarOrVanityResponse) runs FIRST in both
// branches below — see lib/pillar-middleware.ts for the rewrite/redirect logic
// (kept Clerk-free there so it's unit-testable).

// Dashboard + research read APIs + asset upload are staff-only. /community (the
// supporter hub) and /my-giving (the donor portal) require sign-in — any signed-in
// user may reach them and role-gating beyond sign-in happens in-page. The ingest
// route is excluded — it's secured separately by CRON_SECRET (cron has no Clerk
// session).
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/community(.*)",
  "/my-giving(.*)",
  // The /join menu + the lightweight Get-Updates / Donor-Pledge forms are PUBLIC.
  // Only the account-backed detail forms (volunteer profile, captain application)
  // require sign-in — primary CTAs route new users through /sign-up first.
  "/join/volunteer(.*)",
  "/join/captain(.*)",
  "/go",
  "/api/research/member(.*)",
  "/api/assets(.*)",
]);

const clerkEnabled =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

// Origins whose Clerk session tokens we trust (the `azp` claim), so the Chrome
// extension can authenticate by sending its Clerk token as `Authorization: Bearer`
// instead of a cookie. Comma-separated in CLERK_AUTHORIZED_PARTIES (the app origin
// + chrome-extension://<id>). Unset → Clerk's same-origin default; never accept a
// cross-origin token without listing its origin here. Pair with EXTENSION_ORIGIN
// (lib/http/cors.ts), which gates which origin may READ the /api/ext/* responses.
const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const clerkOptions = authorizedParties.length ? { authorizedParties } : undefined;

// With Clerk configured: gate the staff surfaces behind sign-in.
// Without Clerk: FAIL CLOSED in production — never expose donor PII / finance /
// research to the public. Local dev stays open ("demo mode") for convenience.
// Escape hatch: set ALLOW_OPEN_DASHBOARD=true to intentionally show an open demo.
export default clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      const routed = pillarOrVanityResponse(req);
      if (routed) return routed;
      if (!isProtectedRoute(req)) return;
      const { userId } = await auth();
      if (userId) return; // signed in — proceed (allowlist enforced in the dashboard layout + API routes)
      // Signed out: redirect pages to sign-in; answer APIs with 401. (Explicit
      // redirect avoids the Clerk dev-instance protect-rewrite returning a 404.)
      if (req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const signIn = new URL("/sign-in", req.url);
      signIn.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(signIn);
    }, clerkOptions)
  : (req: NextRequest) => {
      const routed = pillarOrVanityResponse(req);
      if (routed) return routed;
      const isProd = process.env.NODE_ENV === "production";
      const allowOpen = process.env.ALLOW_OPEN_DASHBOARD === "true";
      if (isProd && !allowOpen && isProtectedRoute(req)) {
        const url = new URL("/", req.url);
        url.searchParams.set("staff", "locked");
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
