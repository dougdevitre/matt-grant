import { clerkEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (!clerkEnabled) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-6 text-center text-paper">
        <div className="max-w-md">
          <h1 className="font-display text-2xl font-semibold">Staff sign-in not configured</h1>
          <p className="mt-3 text-paper/70">
            Add your Clerk keys (<code className="font-mono text-sm">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
            <code className="font-mono text-sm">CLERK_SECRET_KEY</code>) to enable staff authentication. The
            dashboard currently runs in open demo mode.
          </p>
        </div>
      </div>
    );
  }
  const { SignIn } = await import("@clerk/nextjs");
  return (
    <div className="grid min-h-screen place-items-center bg-ink px-6">
      <SignIn />
    </div>
  );
}
