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
  return (
    <div className="grid min-h-screen place-items-center bg-ink px-6">
      <SignUp />
    </div>
  );
}
