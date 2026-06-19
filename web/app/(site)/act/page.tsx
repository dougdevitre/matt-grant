import type { Metadata } from "next";
import { AgendaBuilder } from "@/components/AgendaBuilder";

export const metadata: Metadata = {
  title: "Your action plan",
  description: "Build a personalized, printable Matt Grant action plan — daily or weekly steps tailored to where you live and the issue you care about most, all driving turnout for August 4.",
};

export default function ActPage() {
  return (
    <section className="container-page py-16 sm:py-24">
      <p className="eyebrow text-brick">Take action</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">Your campaign action plan.</h1>
      <p className="mt-5 max-w-prose text-lg text-slate">
        Tell us where you live and which fight you&rsquo;ll champion, and we&rsquo;ll build a branded, printable
        checklist — daily or weekly — of concrete actions that build awareness and turn out the vote on
        August 4. Print it, check it off, repeat.
      </p>
      <AgendaBuilder />
    </section>
  );
}
