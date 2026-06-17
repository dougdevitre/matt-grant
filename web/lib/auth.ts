// Clerk is optional at build time so the project compiles and deploys before
// keys are wired up. These helpers let the app degrade gracefully: with keys,
// the dashboard is real staff-gated auth; without them, it shows a setup notice.

export const clerkEnabled =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;
