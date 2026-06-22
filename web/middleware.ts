import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

// Dashboard + research read APIs + asset upload are staff-only. /community is the
// supporter hub — any signed-in user may enter (role-gating beyond sign-in happens
// in-page). The ingest route is excluded — it's secured separately by CRON_SECRET
// (cron has no Clerk session).
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/community(.*)",
  "/api/research/member(.*)",
  "/api/assets(.*)",
]);

const clerkEnabled =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

// With Clerk configured: gate the staff surfaces behind sign-in.
// Without Clerk: FAIL CLOSED in production — never expose donor PII / finance /
// research to the public. Local dev stays open ("demo mode") for convenience.
// Escape hatch: set ALLOW_OPEN_DASHBOARD=true to intentionally show an open demo.
export default clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
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
    })
  : (req: NextRequest) => {
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
