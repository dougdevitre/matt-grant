import type { Metadata } from "next";
import { staffGate } from "@/lib/auth";
import { VolunteerDetailForm } from "@/components/join/VolunteerDetailForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Become a Team Captain",
  robots: { index: false, follow: false },
};

// Gated in middleware (sign-in required). A captain application: same structured
// profile as Volunteer plus a "why I lead" note. Submitting does NOT grant the
// captain RBAC role — an admin reviews and promotes from the team page.
export default async function JoinCaptainPage() {
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
      <p className="eyebrow text-brick">Team Captain</p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold sm:text-5xl">Lead a crew.</h1>
      <p className="mt-4 max-w-2xl text-lg text-slate">
        Captains are the backbone of the field program — recruiting, training, and rallying a team of 5–10
        neighbors. Tell us about yourself and we&apos;ll follow up about captain training.
      </p>
      <div className="mt-10 max-w-3xl">
        <VolunteerDetailForm door="Team Captain" defaultName={name} defaultEmail={email ?? ""} />
      </div>
    </section>
  );
}
