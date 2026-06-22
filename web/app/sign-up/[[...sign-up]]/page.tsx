import { clerkEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (!clerkEnabled) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-6 text-center text-paper">
        <div className="max-w-md">
          <h1 className="font-display text-2xl font-semibold">Sign-up not configured</h1>
          <p className="mt-3 text-paper/70">
            Add Clerk keys to enable staff accounts. Until then the dashboard is open in demo mode.
          </p>
        </div>
      </div>
    );
  }
  const { SignUp } = await import("@clerk/nextjs");
  // Organic joins land in the supporter community hub. fallbackRedirectUrl still
  // honors a redirect_url (e.g. a staffer bounced from /dashboard), so only direct
  // sign-ups default to /community.
  return (
    <div className="grid min-h-screen place-items-center bg-ink px-6">
      <SignUp fallbackRedirectUrl="/community" />
    </div>
  );
}
