import type { Metadata } from "next";
import { staffGate } from "@/lib/auth";
import { VolunteerDetailForm } from "@/components/join/VolunteerDetailForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Volunteer — Matt Grant for Congress",
  robots: { index: false, follow: false },
};

// Gated in middleware (sign-in required). Prefills name/email from the session; the
// action re-derives email server-side, so the form value is only a demo fallback.
export default async function JoinVolunteerPage() {
  const { email } = await staffGate();
  let name = "";
  try {
    const { currentUser } = await import("@clerk/nextjs/server");
    const u = await currentUser();
    name = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
  } catch {
    /* clerk off (demo) */
  }

  return (
    <section className="container-page py-16 sm:py-20">
      <p className="eyebrow text-brick">Volunteer</p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold sm:text-5xl">Tell us how you&apos;ll help.</h1>
      <p className="mt-4 max-w-2xl text-lg text-slate">
        A few quick choices and we&apos;ll match you to the work that fits — by where you live, what you&apos;re good
        at, and when you&apos;re free. This race is won one neighbor at a time.
      </p>
      <div className="mt-10 max-w-3xl">
        <VolunteerDetailForm door="Volunteer" defaultName={name} defaultEmail={email ?? ""} />
      </div>
    </section>
  );
}
