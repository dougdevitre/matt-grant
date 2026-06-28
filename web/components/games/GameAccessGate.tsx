"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { decideAccess, getFreeGameId, claimFreeGame } from "@/lib/games/access";
import { MembershipGate } from "./MembershipGate";

// Wraps a game. A visitor may play their FIRST game free; the rest require a (free)
// signed-in account. Renders the game when allowed, the MembershipGate when not.
//
// Clerk's <ClerkProvider> only mounts when clerkEnabled (lib/auth), so useUser() would
// throw in keyless builds. We branch on clerkEnabled and call the hook only on the path
// where the provider exists — hooks stay unconditional within each component.

function GateInner({
  gameId,
  signedIn,
  isLoaded,
  clerkEnabled,
  children,
}: {
  gameId: string;
  signedIn: boolean;
  isLoaded: boolean;
  clerkEnabled: boolean;
  children: React.ReactNode;
}) {
  // undefined = localStorage not read yet (SSR/first paint); null = read, nothing claimed.
  const [freeGameId, setFreeGameId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setFreeGameId(getFreeGameId());
  }, []);

  // Spend the free play on the first game an anonymous visitor opens.
  useEffect(() => {
    if (!isLoaded || freeGameId !== null || signedIn) return;
    claimFreeGame(gameId);
    setFreeGameId(gameId);
  }, [isLoaded, freeGameId, signedIn, gameId]);

  if (!isLoaded || freeGameId === undefined) {
    return <div className="h-40 animate-pulse rounded-lg border border-line bg-white shadow-card" aria-hidden="true" />;
  }

  const decision = decideAccess({ signedIn, gameId, freeGameId });
  if (decision.allowed) return <>{children}</>;
  return <MembershipGate gameId={gameId} freeGameId={freeGameId} clerkEnabled={clerkEnabled} />;
}

function ClerkGate({ gameId, children }: { gameId: string; children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  return (
    <GateInner gameId={gameId} signedIn={!!isSignedIn} isLoaded={isLoaded} clerkEnabled>
      {children}
    </GateInner>
  );
}

export function GameAccessGate({
  gameId,
  clerkEnabled,
  children,
}: {
  gameId: string;
  clerkEnabled: boolean;
  children: React.ReactNode;
}) {
  if (clerkEnabled) return <ClerkGate gameId={gameId}>{children}</ClerkGate>;
  // No Clerk (keyless build): treat everyone as anonymous; the free-play gate still
  // works off localStorage, and the gate explains sign-up is unavailable here.
  return (
    <GateInner gameId={gameId} signedIn={false} isLoaded clerkEnabled={false}>
      {children}
    </GateInner>
  );
}
