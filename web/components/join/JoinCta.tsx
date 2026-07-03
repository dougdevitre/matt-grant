"use client";

// Auth-aware CTA for the Join cards. Resolves signed-in/out CLIENT-side (Clerk
// <SignedIn>/<SignedOut>, same pattern as SiteHeader) so app/(site)/join renders
// statically instead of force-dynamic. Signed-in → straight to the detail form;
// signed-out → sign-up with a redirect back.
//
// Guarded by `clerkEnabled` because the root layout only mounts <ClerkProvider>
// when Clerk is configured — in a keyless/demo build the control components would
// throw at prerender, so we fall back to the sign-up variant (matches the prior
// keyless behavior).
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";

const CLS = "btn-primary mt-5 text-center";

export function JoinCta({
  path,
  signedInLabel,
  signedOutLabel,
  clerkEnabled,
}: {
  path: string;
  signedInLabel: string;
  signedOutLabel: string;
  clerkEnabled: boolean;
}) {
  if (!clerkEnabled) {
    return <Link href={`/sign-up?redirect_url=${path}`} className={CLS}>{signedOutLabel}</Link>;
  }
  return (
    <>
      <SignedIn>
        <Link href={path} className={CLS}>{signedInLabel}</Link>
      </SignedIn>
      <SignedOut>
        <Link href={`/sign-up?redirect_url=${path}`} className={CLS}>{signedOutLabel}</Link>
      </SignedOut>
    </>
  );
}
