import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Dashboard + research read APIs are staff-only. The ingest route is excluded —
// it's secured separately by CRON_SECRET (cron has no Clerk session).
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api/research/member(.*)", "/api/assets(.*)"]);

const clerkEnabled =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

// When Clerk is configured, gate the dashboard behind staff sign-in.
// When it isn't (e.g. a fresh deploy before keys are added), pass through so
// the app still runs and shows the setup notice instead of crashing.
export default clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) await auth.protect();
    })
  : () => NextResponse.next();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
